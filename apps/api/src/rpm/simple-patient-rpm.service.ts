import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type {
  ListSimpleRpmDto,
  SubmitRpmReadingDto,
} from './simple-rpm.dto.js';

const patientAssignmentFields = {
  id: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  cancelledAt: true,

  doctor: {
    select: {
      displayName: true,
    },
  },

  nurse: {
    select: {
      fullName: true,
    },
  },
} satisfies Prisma.RpmAssignmentSelect;

const readingFields = {
  id: true,
  measuredAt: true,
  submittedAt: true,
  weightKg: true,
  temperatureC: true,
  systolicBp: true,
  diastolicBp: true,
  spo2Percent: true,
  pulseBpm: true,
  bloodGlucoseMgDl: true,
  glucoseContext: true,
  notes: true,
} satisfies Prisma.RpmReadingSelect;

function hospitalDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function assignmentState(
  assignment: {
    startDate: Date;
    endDate: Date;
    cancelledAt: Date | null;
  },
  today: string,
) {
  if (assignment.cancelledAt) return 'CANCELLED';

  const start = assignment.startDate.toISOString().slice(0, 10);
  const end = assignment.endDate.toISOString().slice(0, 10);

  if (today < start) return 'SCHEDULED';
  if (today > end) return 'ENDED';

  return 'ACTIVE';
}

function decimal(value: number | undefined) {
  return value === undefined ? null : new Prisma.Decimal(value);
}

@Injectable()
export class SimplePatientRpmService {
  constructor(private readonly database: DatabaseService) {}

  private async patientId(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<string> {
    const account = await tx.patientAccount.findUnique({
      where: {
        id: accountId,
      },

      select: {
        patientId: true,
        isActive: true,
      },
    });

    if (!account?.isActive) {
      throw new UnauthorizedException('Patient account is unavailable.');
    }

    return account.patientId;
  }

  async list(accountId: string, query: ListSimpleRpmDto) {
    return this.database.$transaction(
      async (tx) => {
        const patientId = await this.patientId(tx, accountId);

        const where = {
          patientId,
        };

        const items = await tx.rpmAssignment.findMany({
          where,
          select: patientAssignmentFields,

          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.rpmAssignment.count({
          where,
        });

        const today = hospitalDate(new Date());

        return {
          items: items.map((assignment) => {
            const status = assignmentState(assignment, today);

            return {
              ...assignment,
              status,
              canSubmit: status === 'ACTIVE',
            };
          }),

          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },

          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  /*
   * Used for the patient-home "RPM assigned" message.
   * Returns only an assignment active today.
   */
  async summary(accountId: string) {
    return this.database.$transaction(
      async (tx) => {
        const patientId = await this.patientId(tx, accountId);

        const today = hospitalDate(new Date());
        const calendarToday = new Date(`${today}T00:00:00.000Z`);

        const assignment = await tx.rpmAssignment.findFirst({
          where: {
            patientId,
            cancelledAt: null,

            startDate: {
              lte: calendarToday,
            },

            endDate: {
              gte: calendarToday,
            },
          },

          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],

          select: patientAssignmentFields,
        });

        return {
          assignment: assignment
            ? {
                ...assignment,
                status: 'ACTIVE' as const,
                canSubmit: true,
              }
            : null,

          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  async submit(
    accountId: string,
    assignmentId: string,
    idempotencyKey: string,
    dto: SubmitRpmReadingDto,
  ) {
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(dto.measuredAt)) {
      throw new BadRequestException(
        'Measurement time must include a timezone.',
      );
    }

    const measuredAt = new Date(dto.measuredAt);

    if (!Number.isFinite(measuredAt.getTime())) {
      throw new BadRequestException('Invalid measurement time.');
    }

    const hasMeasurement = [
      dto.weightKg,
      dto.temperatureC,
      dto.systolicBp,
      dto.diastolicBp,
      dto.spo2Percent,
      dto.pulseBpm,
      dto.bloodGlucoseMgDl,
    ].some((value) => value !== undefined);

    if (!hasMeasurement) {
      throw new BadRequestException('Enter at least one vital reading.');
    }

    if ((dto.systolicBp !== undefined) !== (dto.diastolicBp !== undefined)) {
      throw new BadRequestException(
        'Enter systolic and diastolic blood pressure together.',
      );
    }

    if (
      dto.bloodGlucoseMgDl !== undefined &&
      dto.glucoseContext === undefined
    ) {
      throw new BadRequestException(
        'Select the blood glucose measurement context.',
      );
    }

    if (
      dto.glucoseContext !== undefined &&
      dto.bloodGlucoseMgDl === undefined
    ) {
      throw new BadRequestException(
        'Enter blood glucose when selecting a glucose context.',
      );
    }

    const key = idempotencyKey.toLowerCase();

    const payload = {
      assignmentId: assignmentId.toLowerCase(),
      measuredAt: measuredAt.toISOString(),
      weightKg: dto.weightKg ?? null,
      temperatureC: dto.temperatureC ?? null,
      systolicBp: dto.systolicBp ?? null,
      diastolicBp: dto.diastolicBp ?? null,
      spo2Percent: dto.spo2Percent ?? null,
      pulseBpm: dto.pulseBpm ?? null,
      bloodGlucoseMgDl: dto.bloodGlucoseMgDl ?? null,
      glucoseContext: dto.glucoseContext ?? null,
      notes: dto.notes?.trim() || null,
    };

    const requestHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      return await this.database.$transaction(
        async (tx) => {
          const patientId = await this.patientId(tx, accountId);

          await tx.$queryRaw<{ id: string }[]>`
            SELECT "id"::text AS "id"
            FROM "RpmAssignment"
            WHERE "id" = ${assignmentId}::uuid
            FOR UPDATE
          `;

          const assignment = await tx.rpmAssignment.findFirst({
            where: {
              id: assignmentId,
              patientId,
            },

            select: patientAssignmentFields,
          });

          if (!assignment) {
            throw new NotFoundException('RPM assignment not found.');
          }

          // Check replay before the current assignment period.
          const previous = await tx.rpmReading.findUnique({
            where: {
              patientAccountId_idempotencyKey: {
                patientAccountId: accountId,
                idempotencyKey: key,
              },
            },

            select: {
              ...readingFields,
              requestHash: true,
            },
          });

          if (previous) {
            if (previous.requestHash !== requestHash) {
              throw new ConflictException(
                'This request key was used for different readings.',
              );
            }

            const { requestHash: _hash, ...reading } = previous;

            return {
              replayed: true,
              reading,
            };
          }

          const now = new Date();
          const today = hospitalDate(now);

          if (assignmentState(assignment, today) !== 'ACTIVE') {
            throw new ConflictException(
              'Readings can only be submitted during an active RPM assignment.',
            );
          }

          if (measuredAt.getTime() > now.getTime()) {
            throw new BadRequestException(
              'Measurement time cannot be in the future.',
            );
          }

          const measuredDate = hospitalDate(measuredAt);

          const startDate = assignment.startDate.toISOString().slice(0, 10);

          const endDate = assignment.endDate.toISOString().slice(0, 10);

          if (measuredDate < startDate || measuredDate > endDate) {
            throw new BadRequestException(
              'Measurement time must fall within the assigned monitoring dates.',
            );
          }

          const reading = await tx.rpmReading.create({
            data: {
              assignmentId: assignment.id,
              patientAccountId: accountId,
              measuredAt,

              weightKg: decimal(dto.weightKg),
              temperatureC: decimal(dto.temperatureC),
              systolicBp: dto.systolicBp ?? null,
              diastolicBp: dto.diastolicBp ?? null,
              spo2Percent: decimal(dto.spo2Percent),
              pulseBpm: dto.pulseBpm ?? null,
              bloodGlucoseMgDl: decimal(dto.bloodGlucoseMgDl),

              glucoseContext: dto.glucoseContext ?? null,
              notes: payload.notes,

              idempotencyKey: key,
              requestHash,
            },

            select: readingFields,
          });

          return {
            replayed: false,
            reading,
          };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (caught) {
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === 'P2002'
      ) {
        throw new ConflictException(
          'A submission with this request key already exists. Retry the identical request with the same key.',
        );
      }

      throw caught;
    }
  }

  async history(
    accountId: string,
    assignmentId: string,
    query: ListSimpleRpmDto,
  ) {
    return this.database.$transaction(
      async (tx) => {
        const patientId = await this.patientId(tx, accountId);

        const assignment = await tx.rpmAssignment.findFirst({
          where: {
            id: assignmentId,
            patientId,
          },

          select: patientAssignmentFields,
        });

        if (!assignment) {
          throw new NotFoundException('RPM assignment not found.');
        }

        const where = {
          assignmentId: assignment.id,
        };

        const items = await tx.rpmReading.findMany({
          where,
          select: readingFields,

          orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.rpmReading.count({ where });

        const status = assignmentState(assignment, hospitalDate(new Date()));

        return {
          assignment: {
            ...assignment,
            status,
            canSubmit: status === 'ACTIVE',
          },

          items,

          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },

          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }
}
