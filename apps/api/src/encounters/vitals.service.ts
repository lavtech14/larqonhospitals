import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type { CreateVitalsDto } from './create-vitals.dto.js';
import type { ListVitalsDto } from './list-vitals.dto.js';

const observationFields = {
  id: true,
  encounterId: true,
  temperatureC: true,
  pulseBpm: true,
  respiratoryRate: true,
  systolicBp: true,
  diastolicBp: true,
  oxygenSaturation: true,
  weightKg: true,
  heightCm: true,
  measuredAt: true,
  recordedAt: true,
  notes: true,
  recordedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.VitalObservationSelect;

type Observation = Prisma.VitalObservationGetPayload<{
  select: typeof observationFields;
}>;

function serializeObservation(observation: Observation) {
  return {
    ...observation,
    temperatureC:
      observation.temperatureC === null
        ? null
        : Number(observation.temperatureC),
    oxygenSaturation:
      observation.oxygenSaturation === null
        ? null
        : Number(observation.oxygenSaturation),
    weightKg:
      observation.weightKg === null ? null : Number(observation.weightKg),
    heightCm:
      observation.heightCm === null ? null : Number(observation.heightCm),
  };
}

@Injectable()
export class VitalsService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    encounterId: string,
    dto: CreateVitalsDto,
    actorStaffId: string,
    idempotencyKey: string,
  ) {
    const normalizedEncounterId = encounterId.toLowerCase();
    const key = idempotencyKey.toLowerCase();

    const measurements = {
      temperatureC: dto.temperatureC,
      pulseBpm: dto.pulseBpm,
      respiratoryRate: dto.respiratoryRate,
      systolicBp: dto.systolicBp,
      diastolicBp: dto.diastolicBp,
      oxygenSaturation: dto.oxygenSaturation,
      weightKg: dto.weightKg,
      heightCm: dto.heightCm,
    };

    if (!Object.values(measurements).some((value) => value !== undefined)) {
      throw new BadRequestException('Record at least one measurement.');
    }

    const hasSystolic = dto.systolicBp !== undefined;
    const hasDiastolic = dto.diastolicBp !== undefined;

    if (hasSystolic !== hasDiastolic) {
      throw new BadRequestException(
        'Record both systolic and diastolic blood pressure together.',
      );
    }

    const measuredAt = new Date(dto.measuredAt);

    if (!Number.isFinite(measuredAt.getTime())) {
      throw new BadRequestException('Invalid measurement time.');
    }

    const notes = dto.notes?.trim() || null;

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          encounterId: normalizedEncounterId,
          expectedVersion: dto.expectedVersion,
          measuredAt: measuredAt.toISOString(),
          ...measurements,
          notes,
        }),
      )
      .digest('hex');

    return this.database.$transaction(
      async (tx) => {
        // Coordinates with check-in and appointment cancellation.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const encounter = await tx.encounter.findUnique({
          where: { id: normalizedEncounterId },
          select: {
            id: true,
            status: true,
            version: true,
            checkedInAt: true,
            appointment: {
              select: {
                status: true,
                mode: true,
              },
            },
          },
        });

        if (!encounter) {
          throw new NotFoundException('Encounter not found.');
        }

        if (encounter.appointment.mode !== 'IN_PERSON') {
          throw new ConflictException(
            'This workflow currently supports in-person visits only.',
          );
        }

        const previous = await tx.vitalObservation.findUnique({
          where: {
            recordedByStaffId_idempotencyKey: {
              recordedByStaffId: actorStaffId,
              idempotencyKey: key,
            },
          },
          select: {
            id: true,
            encounterId: true,
            requestHash: true,
          },
        });

        // Check replay before version/status validation:
        // a successful save may already have changed the encounter.
        if (previous) {
          if (
            previous.encounterId !== normalizedEncounterId ||
            previous.requestHash !== requestHash
          ) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'This save key was already used for different vitals.',
            });
          }

          const observation = await tx.vitalObservation.findUniqueOrThrow({
            where: { id: previous.id },
            select: observationFields,
          });

          return {
            replayed: true,
            encounter: {
              id: encounter.id,
              version: encounter.version,
            },
            observation: serializeObservation(observation),
          };
        }

        if (
          encounter.appointment.status !== 'BOOKED' ||
          !['CHECKED_IN', 'READY_FOR_DOCTOR'].includes(encounter.status)
        ) {
          throw new ConflictException({
            code: 'ENCOUNTER_NOT_OPEN_FOR_VITALS',
            message:
              'New nursing readings are currently allowed only before the doctor starts the encounter.',
          });
        }

        if (encounter.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: 'ENCOUNTER_VERSION_CONFLICT',
            message: 'This encounter changed. Refresh before recording vitals.',
          });
        }

        const now = new Date();

        // Allow a small difference between browser and server clocks.
        if (measuredAt.getTime() > now.getTime() + 60_000) {
          throw new BadRequestException(
            'The measurement time cannot be in the future.',
          );
        }

        // This initial workflow records measurements after check-in.
        if (measuredAt.getTime() < encounter.checkedInAt.getTime()) {
          throw new BadRequestException(
            'The measurement time must be on or after patient check-in.',
          );
        }

        const updated = await tx.encounter.updateMany({
          where: {
            id: encounter.id,
            version: dto.expectedVersion,
            status: {
              in: ['CHECKED_IN', 'READY_FOR_DOCTOR'],
            },
          },
          data: {
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'ENCOUNTER_VERSION_CONFLICT',
            message: 'This encounter changed. Refresh before recording vitals.',
          });
        }

        const observation = await tx.vitalObservation.create({
          data: {
            encounterId: encounter.id,
            ...measurements,
            measuredAt,
            recordedAt: now,
            recordedByStaffId: actorStaffId,
            notes,
            idempotencyKey: key,
            requestHash,
          },
          select: observationFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'VITALS_RECORDED',
            resourceType: 'VitalObservation',
            resourceId: observation.id,
          },
        });

        return {
          replayed: false,
          encounter: {
            id: encounter.id,
            version: dto.expectedVersion + 1,
          },
          observation: serializeObservation(observation),
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  async list(encounterId: string, query: ListVitalsDto) {
    return this.database.$transaction(
      async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: encounterId },
          select: {
            id: true,
            version: true,
            status: true,
            checkedInAt: true,
            appointment: {
              select: {
                mode: true,
                patient: {
                  select: {
                    id: true,
                    mrn: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (!encounter) {
          throw new NotFoundException('Encounter not found.');
        }

        if (encounter.appointment.mode !== 'IN_PERSON') {
          throw new ConflictException(
            'This workflow currently supports in-person visits only.',
          );
        }

        const where = { encounterId: encounter.id };

        const observations = await tx.vitalObservation.findMany({
          where,
          select: observationFields,
          orderBy: [
            { measuredAt: 'desc' },
            { recordedAt: 'desc' },
            { id: 'desc' },
          ],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.vitalObservation.count({ where });

        return {
          encounter: {
            id: encounter.id,
            version: encounter.version,
            status: encounter.status,
            checkedInAt: encounter.checkedInAt,
          },
          patient: encounter.appointment.patient,
          items: observations.map(serializeObservation),
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
      },
    );
  }
}
