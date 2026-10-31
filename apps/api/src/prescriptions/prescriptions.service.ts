import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type {
  CreatePrescriptionDto,
  ListPrescriptionsDto,
  SavePrescriptionDto,
  IssuePrescriptionDto,
  DiscardPrescriptionDto,
} from './prescription.dto.js';

type Operation = 'CREATE_DRAFT' | 'SAVE_DRAFT' | 'ISSUE' | 'CANCEL';

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class PrescriptionsService {
  constructor(private readonly database: DatabaseService) {}

  issue(
    appointmentId: string,
    id: string,
    actorId: string,
    key: string,
    dto: IssuePrescriptionDto,
  ) {
    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      if (!appointment.encounter) {
        throw new NotFoundException('Prescription not found.');
      }

      const prescription = await tx.prescription.findFirst({
        where: {
          id,
          encounterId: appointment.encounter.id,
        },
        select: {
          id: true,
          authorStaffId: true,
          status: true,
          version: true,
          allergyStatus: true,
          allergyDetails: true,
          replacesPrescriptionId: true,
          items: {
            orderBy: { position: 'asc' },
            select: {
              medicineId: true,
              medicineName: true,
              genericName: true,
              strength: true,
              dosageForm: true,
              dose: true,
              route: true,
              frequency: true,
              duration: true,
              quantity: true,
              quantityUnit: true,
            },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found.');
      }

      if (prescription.authorStaffId !== actorId) {
        throw new ForbiddenException(
          'Only the author can issue this prescription.',
        );
      }

      const requestHash = hash({
        operation: 'ISSUE',
        prescriptionId: prescription.id,
        expectedVersion: dto.expectedVersion,
        reviewConfirmed: dto.reviewConfirmed,
      });

      const previous = await this.replay(
        tx,
        actorId,
        key,
        'ISSUE',
        requestHash,
      );

      if (previous) return previous;

      this.requireOpen(appointment);

      if (prescription.status !== 'DRAFT') {
        throw new ConflictException(
          'Only a draft can be issued. Reload its current status.',
        );
      }

      if (prescription.version !== dto.expectedVersion) {
        throw new ConflictException(
          'This draft changed. Reload and review it before issuing.',
        );
      }

      if (prescription.replacesPrescriptionId) {
        throw new ConflictException(
          'Replacement prescriptions require a separate issuance workflow.',
        );
      }

      if (prescription.allergyStatus === 'NOT_REVIEWED') {
        throw new ConflictException(
          'Complete and save the allergy review before issuing.',
        );
      }

      if (
        ['ALLERGIES_REPORTED', 'UNKNOWN'].includes(
          prescription.allergyStatus,
        ) &&
        !prescription.allergyDetails?.trim()
      ) {
        throw new ConflictException(
          'Document the reported allergies or uncertainty before issuing.',
        );
      }

      if (!prescription.items.length || prescription.items.length > 50) {
        throw new ConflictException(
          'A prescription must contain 1–50 complete medicine lines.',
        );
      }

      for (const item of prescription.items) {
        const quantity = Number(item.quantity);

        if (
          ![
            item.medicineName,
            item.strength,
            item.dosageForm,
            item.dose,
            item.route,
            item.frequency,
            item.duration,
            item.quantityUnit,
          ].every((value) => value.trim()) ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          quantity > 99999999.99
        ) {
          throw new ConflictException(
            'Complete every medicine line before issuing.',
          );
        }
      }

      const medicineIds = [
        ...new Set(prescription.items.map((item) => item.medicineId)),
      ].sort();

      // Prevent catalogue edits while issuance checks and commits.
      await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "Medicine"
      WHERE "id" IN (
        ${Prisma.join(
          medicineIds.map((medicineId) => Prisma.sql`${medicineId}::uuid`),
        )}
      )
      ORDER BY "id"
      FOR SHARE
    `);

      const medicines = await tx.medicine.findMany({
        where: {
          id: { in: medicineIds },
        },
        select: {
          id: true,
          isActive: true,
          displayName: true,
          genericName: true,
          strength: true,
          dosageForm: true,
        },
      });

      const catalogue = new Map(
        medicines.map((medicine) => [medicine.id, medicine]),
      );

      for (const item of prescription.items) {
        const medicine = catalogue.get(item.medicineId);

        if (
          !medicine?.isActive ||
          medicine.displayName !== item.medicineName ||
          medicine.genericName !== item.genericName ||
          medicine.strength !== item.strength ||
          medicine.dosageForm !== item.dosageForm
        ) {
          throw new ConflictException({
            code: 'MEDICINE_CHANGED_OR_UNAVAILABLE',
            medicineId: item.medicineId,
            message:
              'A catalogue entry changed or is inactive. Review, reselect and save before issuing.',
          });
        }
      }

      const prescriberName = appointment.doctor.displayName.trim();

      const registration = appointment.doctor.registrationNumber?.trim();

      if (!prescriberName || !registration) {
        throw new ConflictException(
          'Complete the doctor profile name and registration number before issuing.',
        );
      }

      if (
        !appointment.patient.fullName.trim() ||
        !appointment.patient.mrn.trim()
      ) {
        throw new ConflictException('Patient name and MRN are required.');
      }

      const updated = await tx.prescription.updateMany({
        where: {
          id: prescription.id,
          authorStaffId: actorId,
          status: 'DRAFT',
          version: dto.expectedVersion,
        },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          version: { increment: 1 },

          patientName: appointment.patient.fullName.trim(),
          patientMrn: appointment.patient.mrn.trim(),

          prescriberName,
          prescriberRegistrationNumber: registration,
          prescriberRegistrationAuthority:
            appointment.doctor.registrationAuthority?.trim() || null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'This prescription changed. Reload before issuing.',
        );
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'PRESCRIPTION_ISSUED',
          resourceType: 'Prescription',
          resourceId: prescription.id,
        },
      });

      return this.record(
        tx,
        actorId,
        key,
        'ISSUE',
        requestHash,
        prescription.id,
        dto.expectedVersion + 1,
      );
    });
  }

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
              is: { isActive: true },
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
            id: true,
            mrn: true,
            fullName: true,
          },
        },
        doctor: {
          select: {
            displayName: true,
            registrationNumber: true,
            registrationAuthority: true,
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
      throw new NotFoundException('Assigned appointment not found.');
    }

    if (appointment.mode !== 'IN_PERSON') {
      throw new ConflictException(
        'This prescription workflow currently supports in-person encounters only.',
      );
    }

    return appointment;
  }

  private requireOpen(appointment: {
    status: string;
    encounter: {
      id: string;
      status: string;
      version: number;
    } | null;
  }) {
    if (
      appointment.status !== 'BOOKED' ||
      appointment.encounter?.status !== 'IN_PROGRESS'
    ) {
      throw new ConflictException(
        'Start this encounter before creating or editing prescriptions.',
      );
    }

    return appointment.encounter;
  }

  private mutate<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        return work(tx);
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }

  private async replay(
    tx: Prisma.TransactionClient,
    actorId: string,
    key: string,
    operation: Operation,
    requestHash: string,
  ) {
    const previous = await tx.prescriptionRequest.findUnique({
      where: {
        actorStaffId_key: {
          actorStaffId: actorId,
          key: key.toLowerCase(),
        },
      },
      select: {
        operation: true,
        requestHash: true,
        prescriptionId: true,
        resultVersion: true,
      },
    });

    if (!previous) return null;

    if (
      previous.operation !== operation ||
      previous.requestHash !== requestHash
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'This request key was already used for different prescription details.',
      });
    }

    return {
      replayed: true,
      prescriptionId: previous.prescriptionId,
      version: previous.resultVersion,
    };
  }

  private async record(
    tx: Prisma.TransactionClient,
    actorId: string,
    key: string,
    operation: Operation,
    requestHash: string,
    prescriptionId: string,
    version: number,
  ) {
    await tx.prescriptionRequest.create({
      data: {
        actorStaffId: actorId,
        key: key.toLowerCase(),
        operation,
        requestHash,
        prescriptionId,
        resultVersion: version,
      },
    });

    return {
      replayed: false,
      prescriptionId,
      version,
    };
  }

  list(appointmentId: string, actorId: string, query: ListPrescriptionsDto) {
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

        const items = await tx.prescription.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            id: true,
            status: true,
            version: true,
            createdAt: true,
            updatedAt: true,
            issuedAt: true,
            author: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        });

        const total = await tx.prescription.count({ where });

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
        isolationLevel: 'RepeatableRead',
      },
    );
  }

  get(appointmentId: string, id: string, actorId: string) {
    return this.database.$transaction(
      async (tx) => {
        const appointment = await this.owned(tx, appointmentId, actorId);

        if (!appointment.encounter) {
          throw new NotFoundException('Prescription not found.');
        }

        const prescription = await tx.prescription.findFirst({
          where: {
            id,
            encounterId: appointment.encounter.id,
          },
          select: {
            id: true,
            encounterId: true,
            authorStaffId: true,
            status: true,
            version: true,
            allergyStatus: true,
            allergyDetails: true,
            instructions: true,
            patientName: true,
            patientMrn: true,
            prescriberName: true,
            prescriberRegistrationNumber: true,
            prescriberRegistrationAuthority: true,
            issuedAt: true,
            cancelledAt: true,
            cancellationReason: true,
            replacesPrescriptionId: true,
            replacementReason: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                fullName: true,
              },
            },
            items: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                position: true,
                medicineId: true,
                medicineName: true,
                genericName: true,
                strength: true,
                dosageForm: true,
                dose: true,
                route: true,
                frequency: true,
                duration: true,
                quantity: true,
                quantityUnit: true,
                instructions: true,

                // Current catalogue reference for the draft editor.
                medicine: {
                  select: {
                    id: true,
                    version: true,
                    isActive: true,
                    displayName: true,
                    genericName: true,
                    strength: true,
                    dosageForm: true,
                  },
                },
              },
            },
          },
        });

        if (!prescription) {
          throw new NotFoundException('Prescription not found.');
        }

        return {
          patient: appointment.patient,
          encounter: appointment.encounter,
          prescription: {
            ...prescription,
            items: prescription.items.map((item) => ({
              ...item,
              quantity: Number(item.quantity),
            })),
          },
        };
      },
      {
        isolationLevel: 'RepeatableRead',
      },
    );
  }

  create(
    appointmentId: string,
    actorId: string,
    key: string,
    dto: CreatePrescriptionDto,
  ) {
    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      if (!appointment.encounter) {
        throw new ConflictException('Patient has not checked in.');
      }

      const requestHash = hash({
        operation: 'CREATE_DRAFT',
        encounterId: appointment.encounter.id,
        expectedEncounterVersion: dto.expectedEncounterVersion,
      });

      const previous = await this.replay(
        tx,
        actorId,
        key,
        'CREATE_DRAFT',
        requestHash,
      );

      if (previous) return previous;

      const encounter = this.requireOpen(appointment);

      if (encounter.version !== dto.expectedEncounterVersion) {
        throw new ConflictException(
          'This encounter changed. Refresh before creating a prescription.',
        );
      }

      const existing = await tx.prescription.findFirst({
        where: {
          encounterId: encounter.id,
          authorStaffId: actorId,
          status: 'DRAFT',
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException({
          code: 'DRAFT_ALREADY_EXISTS',
          message: 'Open your existing draft for this encounter.',
          prescriptionId: existing.id,
        });
      }

      const prescription = await tx.prescription.create({
        data: {
          encounterId: encounter.id,
          authorStaffId: actorId,
        },
        select: {
          id: true,
          version: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'PRESCRIPTION_DRAFT_CREATED',
          resourceType: 'Prescription',
          resourceId: prescription.id,
        },
      });

      return this.record(
        tx,
        actorId,
        key,
        'CREATE_DRAFT',
        requestHash,
        prescription.id,
        prescription.version,
      );
    });
  }

  save(
    appointmentId: string,
    id: string,
    actorId: string,
    key: string,
    dto: SavePrescriptionDto,
  ) {
    const items = dto.items.map((item, index) => ({
      position: index + 1,
      medicineId: item.medicineId.toLowerCase(),
      expectedMedicineVersion: item.expectedMedicineVersion,
      dose: item.dose.trim(),
      route: item.route.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim(),
      quantity: item.quantity,
      quantityUnit: item.quantityUnit.trim(),
      instructions: item.instructions?.trim() || null,
    }));

    const header = {
      allergyStatus: dto.allergyStatus,
      allergyDetails: dto.allergyDetails?.trim() || null,
      instructions: dto.instructions?.trim() || null,
    };

    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      if (!appointment.encounter) {
        throw new NotFoundException('Prescription not found.');
      }

      const prescription = await tx.prescription.findFirst({
        where: {
          id,
          encounterId: appointment.encounter.id,
        },
        select: {
          id: true,
          authorStaffId: true,
          status: true,
          version: true,
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found.');
      }

      if (prescription.authorStaffId !== actorId) {
        throw new ForbiddenException('Only the author can edit this draft.');
      }

      const requestHash = hash({
        operation: 'SAVE_DRAFT',
        prescriptionId: prescription.id,
        expectedVersion: dto.expectedVersion,
        ...header,
        items,
      });

      const previous = await this.replay(
        tx,
        actorId,
        key,
        'SAVE_DRAFT',
        requestHash,
      );

      if (previous) return previous;

      this.requireOpen(appointment);

      if (prescription.status !== 'DRAFT') {
        throw new ConflictException('Only draft prescriptions can be edited.');
      }

      if (prescription.version !== dto.expectedVersion) {
        throw new ConflictException(
          'This prescription changed. Reload and review it before saving.',
        );
      }

      const medicines = await tx.medicine.findMany({
        where: {
          id: {
            in: [...new Set(items.map((item) => item.medicineId))],
          },
          isActive: true,
        },
        select: {
          id: true,
          version: true,
          displayName: true,
          genericName: true,
          strength: true,
          dosageForm: true,
        },
      });

      const catalogue = new Map(
        medicines.map((medicine) => [medicine.id, medicine]),
      );

      const lines = items.map((item) => {
        const medicine = catalogue.get(item.medicineId);

        if (!medicine || medicine.version !== item.expectedMedicineVersion) {
          throw new ConflictException({
            code: 'MEDICINE_CHANGED_OR_UNAVAILABLE',
            medicineId: item.medicineId,
            message:
              'A selected medicine changed or is inactive. Review and reselect it.',
          });
        }

        return {
          prescriptionId: prescription.id,
          position: item.position,
          medicineId: medicine.id,
          medicineName: medicine.displayName,
          genericName: medicine.genericName,
          strength: medicine.strength,
          dosageForm: medicine.dosageForm,
          dose: item.dose,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit,
          instructions: item.instructions,
        };
      });

      const updated = await tx.prescription.updateMany({
        where: {
          id: prescription.id,
          authorStaffId: actorId,
          status: 'DRAFT',
          version: dto.expectedVersion,
        },
        data: {
          ...header,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'This draft changed. Reload before saving.',
        );
      }

      // Replace the complete draft list atomically.
      await tx.prescriptionItem.deleteMany({
        where: {
          prescriptionId: prescription.id,
        },
      });

      if (lines.length) {
        await tx.prescriptionItem.createMany({
          data: lines,
        });
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'PRESCRIPTION_DRAFT_SAVED',
          resourceType: 'Prescription',
          resourceId: prescription.id,
        },
      });

      return this.record(
        tx,
        actorId,
        key,
        'SAVE_DRAFT',
        requestHash,
        prescription.id,
        dto.expectedVersion + 1,
      );
    });
  }

  discard(
    appointmentId: string,
    id: string,
    actorId: string,
    key: string,
    dto: DiscardPrescriptionDto,
  ) {
    const reason = dto.reason.trim();

    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      if (!appointment.encounter) {
        throw new NotFoundException('Prescription not found.');
      }

      const prescription = await tx.prescription.findFirst({
        where: {
          id,
          encounterId: appointment.encounter.id,
        },

        select: {
          id: true,
          authorStaffId: true,
          status: true,
          issuedAt: true,
          version: true,
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found.');
      }

      if (prescription.authorStaffId !== actorId) {
        throw new ForbiddenException('Only the author can discard this draft.');
      }

      const requestHash = hash({
        action: 'DISCARD_DRAFT',
        prescriptionId: prescription.id,
        expectedVersion: dto.expectedVersion,
        reason,
      });

      // Resolve an identical retry before checking current status.
      const previous = await this.replay(
        tx,
        actorId,
        key,
        'CANCEL',
        requestHash,
      );

      if (previous) return previous;

      this.requireOpen(appointment);

      if (prescription.status !== 'DRAFT' || prescription.issuedAt !== null) {
        throw new ConflictException(
          'Only an unissued draft can be discarded. Issued prescriptions require a separate cancellation workflow.',
        );
      }

      if (prescription.version !== dto.expectedVersion) {
        throw new ConflictException(
          'This draft changed. Refresh and review it before discarding.',
        );
      }

      if (!reason) {
        throw new ConflictException('A discard reason is required.');
      }

      const updated = await tx.prescription.updateMany({
        where: {
          id: prescription.id,
          encounterId: appointment.encounter.id,
          authorStaffId: actorId,
          status: 'DRAFT',
          issuedAt: null,
          version: dto.expectedVersion,
        },

        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          version: {
            increment: 1,
          },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'This draft changed. Refresh before discarding.',
        );
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'PRESCRIPTION_DRAFT_DISCARDED',
          resourceType: 'Prescription',
          resourceId: prescription.id,
        },
      });

      // Saved medicine lines and previous request receipts remain.
      return this.record(
        tx,
        actorId,
        key,
        'CANCEL',
        requestHash,
        prescription.id,
        dto.expectedVersion + 1,
      );
    });
  }
}
