import { normalizeParameters } from "../lab-shared/structured-results.js";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { createHash } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type {
  CreateLabOrderDto,
  ListLabOrdersDto,
  CancelLabOrderDto,
} from "./lab-order.dto.js";

const orderFields = {
  id: true,
  orderedByStaffId: true,
  status: true,
  priority: true,
  clinicalReason: true,
  patientName: true,
  patientMrn: true,
  doctorName: true,
  version: true,
  orderedAt: true,
  cancelledAt: true,
  cancellationReason: true,

  items: {
    orderBy: {
      position: "asc",
    },

    select: {
      id: true,
      samples: { take: 1, select: { id: true } },
      position: true,
      testCode: true,
      testName: true,
      sampleType: true,
      preparationInstructions: true,
      parameters: true,
    },
  },
} satisfies Prisma.LabOrderSelect;

@Injectable()
export class LabOrdersService {
  constructor(private readonly database: DatabaseService) {}

  private async owned(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    actorId: string,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,

        doctor: {
          is: {
            staffUserId: actorId,
            isActive: true,

            department: {
              is: {
                isActive: true,
              },
            },
          },
        },
      },

      select: {
        id: true,
        status: true,
        mode: true,

        patient: {
          select: {
            fullName: true,
            mrn: true,
          },
        },

        doctor: {
          select: {
            displayName: true,
          },
        },

        encounter: {
          select: {
            id: true,
            status: true,
            version: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException("Assigned appointment not found.");
    }

    if (appointment.mode !== "IN_PERSON") {
      throw new ConflictException(
        "Lab ordering currently supports in-person clinical encounters.",
      );
    }

    return appointment;
  }

  list(appointmentId: string, actorId: string, query: ListLabOrdersDto) {
    return this.database.$transaction(
      async (tx) => {
        const appointment = await this.owned(tx, appointmentId, actorId);

        if (!appointment.encounter) {
          return {
            patient: appointment.patient,
            encounter: null,
            items: [],

            pagination: {
              page: query.page,
              limit: query.limit,
              total: 0,
              totalPages: 0,
            },
          };
        }

        const where = {
          encounterId: appointment.encounter.id,
        };

        const items = await tx.labOrder.findMany({
          where,
          select: orderFields,

          orderBy: [{ orderedAt: "desc" }, { id: "desc" }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.labOrder.count({
          where,
        });

        return {
          patient: appointment.patient,
          encounter: appointment.encounter,
          items,

          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },
      {
        isolationLevel: "RepeatableRead",
        timeout: 15000,
      },
    );
  }

  create(
    appointmentId: string,
    actorId: string,
    key: string,
    dto: CreateLabOrderDto,
  ) {
    const clinicalReason = dto.clinicalReason.trim();

    const tests = dto.tests
      .map((test) => ({
        testId: test.testId.toLowerCase(),
        expectedVersion: test.expectedVersion,
      }))
      .sort((a, b) => a.testId.localeCompare(b.testId));

    if (
      !clinicalReason ||
      new Set(tests.map((test) => test.testId)).size !== tests.length
    ) {
      throw new BadRequestException(
        "Enter a clinical reason and select each test only once.",
      );
    }

    return this.database.$transaction(
      async (tx) => {
        // Same lock as encounter completion and clinical mutations.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const appointment = await this.owned(tx, appointmentId, actorId);

        const encounter = appointment.encounter;

        if (!encounter) {
          throw new ConflictException("Patient has not checked in.");
        }

        const requestHash = createHash("sha256")
          .update(
            JSON.stringify({
              encounterId: encounter.id,
              expectedEncounterVersion: dto.expectedEncounterVersion,
              priority: dto.priority,
              clinicalReason,
              reviewConfirmed: dto.reviewConfirmed,
              tests,
            }),
          )
          .digest("hex");

        const previous = await tx.labOrder.findUnique({
          where: {
            orderedByStaffId_idempotencyKey: {
              orderedByStaffId: actorId,
              idempotencyKey: key.toLowerCase(),
            },
          },

          select: {
            id: true,
            requestHash: true,
          },
        });

        // Retry still resolves if the encounter later completed.
        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException(
              "This request key was already used for a different lab order.",
            );
          }

          return {
            replayed: true,

            order: await tx.labOrder.findUniqueOrThrow({
              where: {
                id: previous.id,
              },

              select: orderFields,
            }),
          };
        }

        if (
          appointment.status !== "BOOKED" ||
          encounter.status !== "IN_PROGRESS"
        ) {
          throw new ConflictException(
            "New lab orders require an encounter in progress.",
          );
        }

        if (encounter.version !== dto.expectedEncounterVersion) {
          throw new ConflictException(
            "The encounter changed. Refresh and review before ordering.",
          );
        }

        // Hold catalogue rows until their snapshots are saved.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "LabTest"
          WHERE "id" IN (
            ${Prisma.join(
              tests.map((test) => Prisma.sql`${test.testId}::uuid`),
            )}
          )
          ORDER BY "id"
          FOR SHARE
        `);

        const catalogue = await tx.labTest.findMany({
          where: {
            id: {
              in: tests.map((test) => test.testId),
            },
          },

          select: {
            id: true,
            version: true,
            isActive: true,
            code: true,
            displayName: true,
            sampleType: true,
            parameters: true,
            preparationInstructions: true,
          },
        });

        const byId = new Map(catalogue.map((test) => [test.id, test]));

        const items = tests.map((selected, index) => {
          const test = byId.get(selected.testId);

          if (!test?.isActive || test.version !== selected.expectedVersion) {
            throw new ConflictException({
              code: "LAB_TEST_CHANGED_OR_UNAVAILABLE",
              testId: selected.testId,
              message:
                "A selected test changed or became inactive. Remove it and select the current entry again.",
            });
          }

          return {
            labTestId: test.id,
            parameters: normalizeParameters(test.parameters),
            position: index + 1,
            testCode: test.code,
            testName: test.displayName,
            sampleType: test.sampleType,
            preparationInstructions: test.preparationInstructions,
          };
        });

        const order = await tx.labOrder.create({
          data: {
            encounterId: encounter.id,
            orderedByStaffId: actorId,
            priority: dto.priority,
            clinicalReason,

            patientName: appointment.patient.fullName,
            patientMrn: appointment.patient.mrn,
            doctorName: appointment.doctor.displayName,

            idempotencyKey: key.toLowerCase(),
            requestHash,

            items: {
              create: items,
            },
          },

          select: orderFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_ORDER_CREATED",
            resourceType: "LabOrder",
            resourceId: order.id,
          },
        });

        return {
          replayed: false,
          order,
        };
      },
      {
        isolationLevel: "ReadCommitted",
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }
  cancel(
    appointmentId: string,
    orderId: string,
    actorId: string,
    key: string,
    dto: CancelLabOrderDto,
  ) {
    const reason = dto.reason.trim();
    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"`;
        const appointment = await this.owned(tx, appointmentId, actorId);
        if (!appointment.encounter)
          throw new NotFoundException("Lab order not found.");
        const order = await tx.labOrder.findFirst({
          where: { id: orderId, encounterId: appointment.encounter.id },
          select: {
            id: true,
            version: true,
            status: true,
            orderedByStaffId: true,
          },
        });
        if (!order) throw new NotFoundException("Lab order not found.");
        if (order.orderedByStaffId !== actorId)
          throw new ConflictException(
            "Only the ordering doctor can cancel this order.",
          );
        const requestHash = createHash("sha256")
          .update(
            JSON.stringify({
              orderId: order.id,
              expectedVersion: dto.expectedVersion,
              reason,
            }),
          )
          .digest("hex");
        const previous = await tx.labOrderCancellation.findUnique({
          where: {
            actorStaffId_idempotencyKey: {
              actorStaffId: actorId,
              idempotencyKey: key.toLowerCase(),
            },
          },
          select: { requestHash: true },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new ConflictException(
              "This cancellation key was used for a different request.",
            );
          return {
            replayed: true,
            order: await tx.labOrder.findUniqueOrThrow({
              where: { id: order.id },
              select: orderFields,
            }),
          };
        }
        if (
          order.status !== "ORDERED" ||
          order.version !== dto.expectedVersion
        ) {
          throw new ConflictException(
            "The order changed or is no longer cancellable. Refresh first.",
          );
        }
        const billingCharges = await tx.billingInvoiceLine.count({
          where: {
            labOrderItem: { orderId: order.id },
            reservedKey: { not: null },
          },
        });
        if (billingCharges > 0)
          throw new ConflictException(
            "This order has billing charges. Cancel its draft invoice first; issued invoices require billing review.",
          );
        const samples = await tx.labSample.count({
          where: { orderItem: { is: { orderId: order.id } } },
        });
        if (samples > 0)
          throw new ConflictException(
            "Cancellation is allowed only before any sample collection attempt.",
          );
        const updated = await tx.labOrder.updateMany({
          where: {
            id: order.id,
            version: dto.expectedVersion,
            status: "ORDERED",
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: reason,
            cancelledByStaffId: actorId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException("The order changed. Refresh first.");
        await tx.labOrderCancellation.create({
          data: {
            orderId: order.id,
            actorStaffId: actorId,
            idempotencyKey: key.toLowerCase(),
            requestHash,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_ORDER_CANCELLED",
            resourceType: "LabOrder",
            resourceId: order.id,
          },
        });
        return {
          replayed: false,
          order: await tx.labOrder.findUniqueOrThrow({
            where: { id: order.id },
            select: orderFields,
          }),
        };
      },
      { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
    );
  }
}
