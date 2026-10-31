import { buildResultValues } from "../lab-shared/structured-results.js";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { createHash } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type { ReleaseLabReportDto } from "./release-lab-report.dto.js";

const reportFields = {
  values: true,
  id: true,
  sourceRevisionId: true,

  patientName: true,
  patientMrn: true,
  doctorName: true,

  testCode: true,
  testName: true,
  sampleType: true,
  specimenReference: true,
  collectedAt: true,

  method: true,
  resultText: true,
  comments: true,

  reviewerName: true,
  releasedAt: true,
} satisfies Prisma.LabReleasedReportSelect;

const sampleFields = {
  id: true,
  version: true,
  specimenReference: true,
  collectedAt: true,

  orderItem: {
    select: {
      parameters: true,
      testCode: true,
      testName: true,
      sampleType: true,

      order: {
        select: {
          status: true,
          patientName: true,
          patientMrn: true,
          doctorName: true,
        },
      },
    },
  },
  currentOrderItem: {
    select: {
      id: true,
    },
  },

  rejection: {
    select: {
      reason: true,
      rejectedAt: true,
    },
  },
} satisfies Prisma.LabSampleSelect;

const draftFields = {
  values: true,
  id: true,
  revision: true,
  authorStaffId: true,
  method: true,
  resultText: true,
  comments: true,
  createdAt: true,

  author: {
    select: {
      fullName: true,
    },
  },
} satisfies Prisma.LabResultRevisionSelect;

@Injectable()
export class LabReportsService {
  constructor(private readonly database: DatabaseService) {}

  read(sampleId: string) {
    return this.database.$transaction(
      async (tx) => {
        const sample = await tx.labSample.findUnique({
          where: {
            id: sampleId,
          },
          select: sampleFields,
        });

        if (!sample) {
          throw new NotFoundException("Collected specimen not found.");
        }

        const latestDraft = await tx.labResultRevision.findFirst({
          where: {
            sampleId: sample.id,
          },

          orderBy: {
            revision: "desc",
          },

          select: draftFields,
        });

        const report = await tx.labReleasedReport.findUnique({
          where: {
            sampleId: sample.id,
          },

          select: reportFields,
        });

        return {
          sample,
          latestDraft,
          report,
        };
      },
      {
        isolationLevel: "RepeatableRead",
        timeout: 15000,
      },
    );
  }

  release(
    sampleId: string,
    actorId: string,
    key: string,
    dto: ReleaseLabReportDto,
  ) {
    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const sample = await tx.labSample.findUnique({
          where: {
            id: sampleId,
          },

          select: sampleFields,
        });

        if (!sample) {
          throw new NotFoundException("Collected specimen not found.");
        }

        const requestHash = createHash("sha256")
          .update(
            JSON.stringify({
              sampleId: sample.id,
              expectedVersion: dto.expectedVersion,
              sourceRevisionId: dto.sourceRevisionId.toLowerCase(),
              reviewConfirmed: dto.reviewConfirmed,
            }),
          )
          .digest("hex");

        const previous = await tx.labReleasedReport.findUnique({
          where: {
            reviewedByStaffId_idempotencyKey: {
              reviewedByStaffId: actorId,
              idempotencyKey: key.toLowerCase(),
            },
          },

          select: {
            id: true,
            requestHash: true,
          },
        });
        if (!sample.currentOrderItem || sample.rejection) {
          throw new ConflictException(
            "A rejected or superseded specimen cannot be released.",
          );
        }

        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException(
              "This request key was used for a different report release.",
            );
          }

          return {
            replayed: true,

            report: await tx.labReleasedReport.findUniqueOrThrow({
              where: {
                id: previous.id,
              },

              select: reportFields,
            }),
          };
        }

        const existing = await tx.labReleasedReport.findUnique({
          where: {
            sampleId: sample.id,
          },

          select: {
            id: true,
          },
        });

        if (existing) {
          throw new ConflictException(
            "This report has already been released. Refresh to view it.",
          );
        }

        if (!["ORDERED", "COLLECTED"].includes(sample.orderItem.order.status)) {
          throw new ConflictException(
            "The current order status does not allow report release.",
          );
        }

        if (sample.version !== dto.expectedVersion) {
          throw new ConflictException(
            "The result changed. Refresh and review the latest revision.",
          );
        }

        const latestDraft = await tx.labResultRevision.findFirst({
          where: {
            sampleId: sample.id,
          },

          orderBy: {
            revision: "desc",
          },

          select: draftFields,
        });

        if (
          !latestDraft ||
          latestDraft.id !== dto.sourceRevisionId.toLowerCase()
        ) {
          throw new ConflictException(
            "Review the latest saved result revision before releasing.",
          );
        }

        if (latestDraft.authorStaffId === actorId) {
          throw new ForbiddenException(
            "A different reviewer must release this result revision.",
          );
        }

        const values = buildResultValues(
          sample.orderItem.parameters,
          latestDraft.values,
          latestDraft.resultText,
        );

        const reviewer = await tx.staffUser.findUnique({
          where: {
            id: actorId,
          },

          select: {
            fullName: true,
            isActive: true,
          },
        });

        if (!reviewer?.isActive || !reviewer.fullName.trim()) {
          throw new ForbiddenException(
            "An active reviewer account is required.",
          );
        }

        const updated = await tx.labSample.updateMany({
          where: {
            id: sample.id,
            version: dto.expectedVersion,
          },

          data: {
            version: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            "The result changed. Refresh before releasing.",
          );
        }

        const order = sample.orderItem.order;

        const report = await tx.labReleasedReport.create({
          data: {
            sampleId: sample.id,
            sourceRevisionId: latestDraft.id,
            reviewedByStaffId: actorId,

            patientName: order.patientName,
            patientMrn: order.patientMrn,
            doctorName: order.doctorName,

            testCode: sample.orderItem.testCode,
            testName: sample.orderItem.testName,
            sampleType: sample.orderItem.sampleType,

            specimenReference: sample.specimenReference,
            collectedAt: sample.collectedAt,

            values,
            method: latestDraft.method,
            resultText: latestDraft.resultText,
            comments: latestDraft.comments,

            reviewerName: reviewer.fullName.trim(),

            idempotencyKey: key.toLowerCase(),
            requestHash,
          },

          select: reportFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_REPORT_RELEASED",
            resourceType: "LabReleasedReport",
            resourceId: report.id,
          },
        });

        return {
          replayed: false,
          report,
        };
      },
      {
        isolationLevel: "ReadCommitted",
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }
}
