import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type {
  DoctorEncounterQueryDto,
  EncounterVersionDto,
  SaveClinicalNotesDto,
} from './doctor-encounter.dto.js';

const encounterFields = {
  id: true,
  status: true,
  version: true,
  checkedInAt: true,
  readyForDoctorAt: true,
  startedAt: true,
  completedAt: true,
} satisfies Prisma.EncounterSelect;

const noteFields = {
  id: true,
  revision: true,
  complaint: true,
  history: true,
  examination: true,
  assessment: true,
  plan: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.ClinicalNoteRevisionSelect;

@Injectable()
export class DoctorEncountersService {
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
              is: { isActive: true },
            },
          },
        },
      },
      select: {
        id: true,
        status: true,
        mode: true,
        startsAt: true,
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
          },
        },
        encounter: {
          select: encounterFields,
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Assigned appointment not found.');
    }

    if (appointment.mode !== 'IN_PERSON') {
      throw new ConflictException(
        'This encounter workflow currently supports in-person appointments only.',
      );
    }

    return appointment;
  }

  private mutate<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(
      async (tx) => {
        // Same lock as check-in, vitals and nursing handover.
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

  async read(
    appointmentId: string,
    actorId: string,
    query: DoctorEncounterQueryDto,
  ) {
    return this.database.$transaction(
      async (tx) => {
        const appointment = await this.owned(tx, appointmentId, actorId);

        const encounter = appointment.encounter;

        const paginate = (total: number, page: number) => ({
          total,
          page,
          totalPages: Math.ceil(total / 10),
        });

        if (!encounter) {
          return {
            appointment,
            latestNote: null,
            vitals: {
              items: [],
              ...paginate(0, query.vitalsPage),
            },
            notes: {
              items: [],
              ...paginate(0, query.notesPage),
            },
          };
        }

        const where = { encounterId: encounter.id };

        const vitals = await tx.vitalObservation.findMany({
          where,
          orderBy: [
            { measuredAt: 'desc' },
            { recordedAt: 'desc' },
            { id: 'desc' },
          ],
          skip: (query.vitalsPage - 1) * 10,
          take: 10,
          select: {
            id: true,
            measuredAt: true,
            recordedAt: true,
            temperatureC: true,
            pulseBpm: true,
            respiratoryRate: true,
            systolicBp: true,
            diastolicBp: true,
            oxygenSaturation: true,
            weightKg: true,
            heightCm: true,
            notes: true,
            recordedBy: {
              select: { fullName: true },
            },
          },
        });

        const vitalTotal = await tx.vitalObservation.count({ where });

        const notes = await tx.clinicalNoteRevision.findMany({
          where,
          select: noteFields,
          orderBy: { revision: 'desc' },
          skip: (query.notesPage - 1) * 10,
          take: 10,
        });

        const noteTotal = await tx.clinicalNoteRevision.count({ where });

        const latestNote = await tx.clinicalNoteRevision.findFirst({
          where,
          select: noteFields,
          orderBy: { revision: 'desc' },
        });

        return {
          appointment,
          latestNote,
          vitals: {
            items: vitals.map((v) => ({
              ...v,
              temperatureC:
                v.temperatureC === null ? null : Number(v.temperatureC),
              oxygenSaturation:
                v.oxygenSaturation === null ? null : Number(v.oxygenSaturation),
              weightKg: v.weightKg === null ? null : Number(v.weightKg),
              heightCm: v.heightCm === null ? null : Number(v.heightCm),
            })),
            ...paginate(vitalTotal, query.vitalsPage),
          },
          notes: {
            items: notes,
            ...paginate(noteTotal, query.notesPage),
          },
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  start(appointmentId: string, actorId: string, dto: EncounterVersionDto) {
    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      const encounter = appointment.encounter;

      if (!encounter || appointment.status !== 'BOOKED') {
        throw new ConflictException(
          'A booked, checked-in encounter is required.',
        );
      }

      // Repeating start must preserve the original start time.
      if (
        encounter.startedAt &&
        ['IN_PROGRESS', 'COMPLETED'].includes(encounter.status)
      ) {
        return {
          alreadyStarted: true,
          encounter,
        };
      }

      if (encounter.status !== 'READY_FOR_DOCTOR') {
        throw new ConflictException(
          'The nurse must mark this encounter ready first.',
        );
      }

      const updated = await tx.encounter.updateMany({
        where: {
          id: encounter.id,
          version: dto.expectedVersion,
          status: 'READY_FOR_DOCTOR',
        },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'This encounter changed. Refresh before starting.',
        );
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'ENCOUNTER_STARTED',
          resourceType: 'Encounter',
          resourceId: encounter.id,
        },
      });

      return {
        alreadyStarted: false,
        encounter: await tx.encounter.findUniqueOrThrow({
          where: { id: encounter.id },
          select: encounterFields,
        }),
      };
    });
  }

  async save(
    appointmentId: string,
    actorId: string,
    key: string,
    dto: SaveClinicalNotesDto,
  ) {
    const document = {
      complaint: dto.complaint.trim(),
      history: dto.history.trim(),
      examination: dto.examination.trim(),
      assessment: dto.assessment.trim(),
      plan: dto.plan.trim(),
    };

    if (!Object.values(document).some(Boolean)) {
      throw new BadRequestException(
        'Enter at least one clinical note section.',
      );
    }

    return this.mutate(async (tx) => {
      const appointment = await this.owned(tx, appointmentId, actorId);

      const encounter = appointment.encounter;

      if (!encounter) {
        throw new ConflictException('Patient has not checked in.');
      }

      const requestHash = createHash('sha256')
        .update(
          JSON.stringify({
            encounterId: encounter.id,
            expectedVersion: dto.expectedVersion,
            ...document,
          }),
        )
        .digest('hex');

      const previous = await tx.clinicalNoteRevision.findUnique({
        where: {
          authorStaffId_idempotencyKey: {
            authorStaffId: actorId,
            idempotencyKey: key.toLowerCase(),
          },
        },
        select: {
          id: true,
          requestHash: true,
        },
      });

      // Resolve an earlier successful save before checking
      // the current encounter version or status.
      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw new ConflictException(
            'This save key was already used for different notes.',
          );
        }

        return {
          replayed: true,
          note: await tx.clinicalNoteRevision.findUniqueOrThrow({
            where: { id: previous.id },
            select: noteFields,
          }),
        };
      }

      if (
        appointment.status !== 'BOOKED' ||
        encounter.status !== 'IN_PROGRESS'
      ) {
        throw new ConflictException(
          'Start this encounter before saving notes.',
        );
      }

      const updated = await tx.encounter.updateMany({
        where: {
          id: encounter.id,
          version: dto.expectedVersion,
          status: 'IN_PROGRESS',
        },
        data: {
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'This encounter changed. Review the latest notes before saving.',
        );
      }

      const latest = await tx.clinicalNoteRevision.findFirst({
        where: { encounterId: encounter.id },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });

      const note = await tx.clinicalNoteRevision.create({
        data: {
          encounterId: encounter.id,
          authorStaffId: actorId,
          revision: (latest?.revision ?? 0) + 1,
          ...document,
          idempotencyKey: key.toLowerCase(),
          requestHash,
        },
        select: noteFields,
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId: actorId,
          action: 'CLINICAL_NOTES_SAVED',
          resourceType: 'ClinicalNoteRevision',
          resourceId: note.id,
        },
      });

      return {
        replayed: false,
        note,
      };
    });
  }
}
