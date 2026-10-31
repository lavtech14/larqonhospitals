import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type { PublishVisitSummaryDto } from './publish-visit-summary.dto.js';

const summaryFields = {
  id: true,
  encounterId: true,
  sourceNoteRevisionId: true,

  patientName: true,
  patientMrn: true,

  doctorName: true,
  doctorRegistrationNumber: true,
  doctorRegistrationAuthority: true,

  summary: true,
  carePlan: true,
  followUp: true,
  returnPrecautions: true,

  publishedAt: true,
} satisfies Prisma.PublishedVisitSummarySelect;

@Injectable()
export class VisitSummariesService {
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
            registrationNumber: true,
            registrationAuthority: true,
          },
        },

        encounter: {
          select: {
            id: true,
            status: true,
            version: true,
            completedAt: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Assigned appointment not found.');
    }

    if (appointment.mode !== 'IN_PERSON') {
      throw new ConflictException(
        'This clinical encounter workflow currently supports in-person appointments only.',
      );
    }

    return appointment;
  }

  async read(appointmentId: string, actorId: string) {
    return this.database.$transaction(
      async (tx) => {
        const appointment = await this.owned(tx, appointmentId, actorId);

        if (!appointment.encounter) {
          throw new ConflictException('Patient has not checked in.');
        }

        const encounterId = appointment.encounter.id;

        const sourceNote = await tx.clinicalNoteRevision.findFirst({
          where: {
            encounterId,
          },

          orderBy: {
            revision: 'desc',
          },

          select: {
            id: true,
            revision: true,
            assessment: true,
            plan: true,
          },
        });

        const publishedSummary = await tx.publishedVisitSummary.findUnique({
          where: {
            encounterId,
          },
          select: summaryFields,
        });

        const draftPrescriptionCount = await tx.prescription.count({
          where: {
            encounterId,
            status: 'DRAFT',
          },
        });

        return {
          appointmentId: appointment.id,
          patient: appointment.patient,
          encounter: appointment.encounter,
          sourceNote,
          draftPrescriptionCount,
          publishedSummary,
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  async publish(
    appointmentId: string,
    actorId: string,
    key: string,
    dto: PublishVisitSummaryDto,
  ) {
    const document = {
      summary: dto.summary.trim(),
      carePlan: dto.carePlan.trim(),
      followUp: dto.followUp.trim(),
      returnPrecautions: dto.returnPrecautions.trim(),
    };

    if (!document.summary || !document.carePlan) {
      throw new BadRequestException(
        'A visit summary and care plan are required.',
      );
    }

    const idempotencyKey = key.toLowerCase();

    return this.database.$transaction(
      async (tx) => {
        // Use the same lock as the existing encounter,
        // note, and prescription mutations.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const appointment = await this.owned(tx, appointmentId, actorId);

        const encounter = appointment.encounter;

        if (!encounter) {
          throw new ConflictException('Patient has not checked in.');
        }

        const requestHash = createHash('sha256')
          .update(
            JSON.stringify({
              appointmentId: appointment.id,
              encounterId: encounter.id,
              expectedVersion: dto.expectedVersion,
              sourceNoteRevisionId: dto.sourceNoteRevisionId.toLowerCase(),
              reviewConfirmed: dto.reviewConfirmed,
              ...document,
            }),
          )
          .digest('hex');

        const previous = await tx.publishedVisitSummary.findUnique({
          where: {
            publishedByStaffId_idempotencyKey: {
              publishedByStaffId: actorId,
              idempotencyKey,
            },
          },

          select: {
            id: true,
            requestHash: true,
          },
        });

        // Check replay before checking the completed status.
        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException(
              'This publication key was used for a different request.',
            );
          }

          return {
            replayed: true,

            publishedSummary: await tx.publishedVisitSummary.findUniqueOrThrow({
              where: {
                id: previous.id,
              },
              select: summaryFields,
            }),
          };
        }

        const existing = await tx.publishedVisitSummary.findUnique({
          where: {
            encounterId: encounter.id,
          },

          select: {
            id: true,
          },
        });

        if (existing) {
          throw new ConflictException(
            'This visit summary has already been published. Refresh to view it.',
          );
        }

        if (
          appointment.status !== 'BOOKED' ||
          encounter.status !== 'IN_PROGRESS'
        ) {
          throw new ConflictException(
            'Only an encounter in progress can be finalized.',
          );
        }

        if (encounter.version !== dto.expectedVersion) {
          throw new ConflictException(
            'The encounter changed. Review the latest notes before publishing.',
          );
        }

        const latestNote = await tx.clinicalNoteRevision.findFirst({
          where: {
            encounterId: encounter.id,
          },

          orderBy: {
            revision: 'desc',
          },

          select: {
            id: true,
          },
        });

        if (
          !latestNote ||
          latestNote.id !== dto.sourceNoteRevisionId.toLowerCase()
        ) {
          throw new ConflictException(
            'Save and review the latest clinical notes before publishing.',
          );
        }

        const draftPrescriptionCount = await tx.prescription.count({
          where: {
            encounterId: encounter.id,
            status: 'DRAFT',
          },
        });

        if (draftPrescriptionCount > 0) {
          throw new ConflictException(
            'Issue all prescription drafts before completing this encounter.',
          );
        }

        const patientName = appointment.patient.fullName.trim();
        const patientMrn = appointment.patient.mrn.trim();
        const doctorName = appointment.doctor.displayName.trim();

        if (!patientName || !patientMrn || !doctorName) {
          throw new ConflictException(
            'Patient and doctor identity details are incomplete.',
          );
        }

        const publishedAt = new Date();

        const updated = await tx.encounter.updateMany({
          where: {
            id: encounter.id,
            version: dto.expectedVersion,
            status: 'IN_PROGRESS',
          },

          data: {
            status: 'COMPLETED',
            completedAt: publishedAt,
            version: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            'The encounter changed. Refresh before publishing.',
          );
        }

        const publishedSummary = await tx.publishedVisitSummary.create({
          data: {
            encounterId: encounter.id,
            sourceNoteRevisionId: latestNote.id,
            publishedByStaffId: actorId,

            patientName,
            patientMrn,
            doctorName,

            doctorRegistrationNumber:
              appointment.doctor.registrationNumber?.trim() || null,

            doctorRegistrationAuthority:
              appointment.doctor.registrationAuthority?.trim() || null,

            ...document,

            publishedAt,
            idempotencyKey,
            requestHash,
          },

          select: summaryFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: 'VISIT_SUMMARY_PUBLISHED',
            resourceType: 'PublishedVisitSummary',
            resourceId: publishedSummary.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: 'ENCOUNTER_COMPLETED',
            resourceType: 'Encounter',
            resourceId: encounter.id,
          },
        });

        return {
          replayed: false,
          publishedSummary,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }
}
