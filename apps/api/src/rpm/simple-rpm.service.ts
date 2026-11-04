import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type {
  CreateRpmAssignmentDto,
  ListSimpleRpmDto,
} from './simple-rpm.dto.js';

const assignmentFields = {
  id: true,
  startDate: true,
  endDate: true,
  reason: true,
  notes: true,
  createdAt: true,
  cancelledAt: true,

  patient: {
    select: {
      id: true,
      fullName: true,
      mrn: true,
    },
  },

  doctor: {
    select: {
      id: true,
      displayName: true,
    },
  },

  nurse: {
    select: {
      id: true,
      fullName: true,
      isActive: true,
    },
  },
} satisfies Prisma.RpmAssignmentSelect;

function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Invalid calendar date.');
  }

  return date;
}

function hospitalToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function assignmentStatus(
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

function escapeSearch(value?: string) {
  return value?.trim().replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class SimpleRpmService {
  constructor(private readonly database: DatabaseService) {}

  private async requireDoctor(
    tx: Prisma.TransactionClient,
    actorId: string,
  ): Promise<string> {
    const doctor = await tx.doctorProfile.findFirst({
      where: {
        staffUserId: actorId,
        isActive: true,

        department: {
          is: {
            isActive: true,
          },
        },

        staffUser: {
          is: {
            isActive: true,
            roles: {
              some: {
                role: 'DOCTOR',
              },
            },
          },
        },
      },

      select: {
        id: true,
      },
    });

    if (!doctor) {
      throw new ForbiddenException(
        'An active linked doctor profile is required.',
      );
    }

    return doctor.id;
  }

  private async accessScope(
    tx: Prisma.TransactionClient,
    actorId: string,
  ): Promise<Prisma.RpmAssignmentWhereInput> {
    const staff = await tx.staffUser.findUnique({
      where: {
        id: actorId,
      },

      select: {
        isActive: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!staff?.isActive) {
      throw new ForbiddenException('Staff account is unavailable.');
    }

    const roles = new Set(staff.roles.map((assignment) => assignment.role));

    const scopes: Prisma.RpmAssignmentWhereInput[] = [];

    if (roles.has('DOCTOR')) {
      const doctor = await tx.doctorProfile.findFirst({
        where: {
          staffUserId: actorId,
          isActive: true,

          department: {
            is: {
              isActive: true,
            },
          },
        },

        select: {
          id: true,
        },
      });

      if (doctor) {
        scopes.push({
          doctorId: doctor.id,
        });
      }
    }

    if (roles.has('NURSE')) {
      scopes.push({
        nurseStaffId: actorId,
      });
    }

    if (scopes.length === 0) {
      throw new ForbiddenException(
        'RPM access is unavailable for this account.',
      );
    }

    return {
      OR: scopes,
    };
  }

  async lookupPatient(actorId: string, mrn: string) {
    return this.database.$transaction(
      async (tx) => {
        await this.requireDoctor(tx, actorId);

        const patient = await tx.patient.findUnique({
          where: {
            mrn: mrn.trim(),
          },

          select: {
            id: true,
            fullName: true,
            mrn: true,

            account: {
              select: {
                isActive: true,
              },
            },
          },
        });

        if (!patient) {
          throw new NotFoundException(
            'No patient was found with that exact MRN.',
          );
        }

        return {
          id: patient.id,
          fullName: patient.fullName,
          mrn: patient.mrn,
          hasActivePortalAccount: patient.account?.isActive === true,
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  async nurses(actorId: string, query: ListSimpleRpmDto) {
    return this.database.$transaction(
      async (tx) => {
        await this.requireDoctor(tx, actorId);

        const search = escapeSearch(query.search);

        const where = {
          isActive: true,

          roles: {
            some: {
              role: 'NURSE',
            },
          },

          ...(search
            ? {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              }
            : {}),
        } satisfies Prisma.StaffUserWhereInput;

        const items = await tx.staffUser.findMany({
          where,

          select: {
            id: true,
            fullName: true,
          },

          orderBy: [{ fullName: 'asc' }, { id: 'asc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.staffUser.count({ where });

        return {
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
        timeout: 15000,
      },
    );
  }

  async assign(
    actorId: string,
    idempotencyKey: string,
    dto: CreateRpmAssignmentDto,
  ) {
    const startDate = calendarDate(dto.startDate);
    const endDate = calendarDate(dto.endDate);

    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'End date cannot be before the start date.',
      );
    }

    const key = idempotencyKey.toLowerCase();

    const payload = {
      patientId: dto.patientId.toLowerCase(),
      nurseStaffId: dto.nurseStaffId.toLowerCase(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason.trim(),
      notes: dto.notes?.trim() || null,
    };

    const requestHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      return await this.database.$transaction(
        async (tx) => {
          const doctorId = await this.requireDoctor(tx, actorId);

          // Serialize assignment creation for this patient.
          const patients = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id"::text AS "id"
            FROM "Patient"
            WHERE "id" = ${dto.patientId}::uuid
            FOR UPDATE
          `;

          if (patients.length === 0) {
            throw new NotFoundException('Patient not found.');
          }

          const previous = await tx.rpmAssignment.findUnique({
            where: {
              assignedByStaffId_idempotencyKey: {
                assignedByStaffId: actorId,
                idempotencyKey: key,
              },
            },

            select: {
              ...assignmentFields,
              requestHash: true,
            },
          });

          if (previous) {
            if (previous.requestHash !== requestHash) {
              throw new ConflictException(
                'This request key was used for another assignment.',
              );
            }

            const { requestHash: _hash, ...assignment } = previous;

            return {
              replayed: true,
              assignment: {
                ...assignment,
                status: assignmentStatus(assignment, hospitalToday()),
              },
            };
          }

          if (dto.endDate < hospitalToday()) {
            throw new BadRequestException(
              'The monitoring end date cannot be in the past.',
            );
          }

          const account = await tx.patientAccount.findUnique({
            where: {
              patientId: dto.patientId,
            },

            select: {
              isActive: true,
            },
          });

          if (!account?.isActive) {
            throw new BadRequestException(
              'Create or activate the patient portal account before assigning RPM.',
            );
          }

          const nurse = await tx.staffUser.findFirst({
            where: {
              id: dto.nurseStaffId,
              isActive: true,

              roles: {
                some: {
                  role: 'NURSE',
                },
              },
            },

            select: {
              id: true,
            },
          });

          if (!nurse) {
            throw new BadRequestException('Select an active nurse account.');
          }

          const overlapping = await tx.rpmAssignment.findFirst({
            where: {
              patientId: dto.patientId,
              cancelledAt: null,

              startDate: {
                lte: endDate,
              },

              endDate: {
                gte: startDate,
              },
            },

            select: {
              id: true,
            },
          });

          if (overlapping) {
            throw new ConflictException(
              'This patient already has RPM assigned for an overlapping period.',
            );
          }

          const assignment = await tx.rpmAssignment.create({
            data: {
              patientId: dto.patientId,
              doctorId,
              nurseStaffId: nurse.id,
              assignedByStaffId: actorId,
              startDate,
              endDate,
              reason: payload.reason,
              notes: payload.notes,
              idempotencyKey: key,
              requestHash,
            },

            select: assignmentFields,
          });

          await tx.auditEvent.create({
            data: {
              actorStaffId: actorId,
              action: 'SIMPLE_RPM_ASSIGNED',
              resourceType: 'RpmAssignment',
              resourceId: assignment.id,
            },
          });

          return {
            replayed: false,
            assignment: {
              ...assignment,
              status: assignmentStatus(assignment, hospitalToday()),
            },
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
          'An assignment request already exists. Retry the identical request with the same key.',
        );
      }

      throw caught;
    }
  }

  async list(actorId: string, query: ListSimpleRpmDto) {
    return this.database.$transaction(
      async (tx) => {
        const scope = await this.accessScope(tx, actorId);
        const search = escapeSearch(query.search);

        const where = {
          AND: [
            scope,

            ...(search
              ? [
                  {
                    patient: {
                      is: {
                        OR: [
                          {
                            fullName: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            mrn: {
                              contains: search,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      },
                    },
                  },
                ]
              : []),
          ],
        } satisfies Prisma.RpmAssignmentWhereInput;

        const items = await tx.rpmAssignment.findMany({
          where,
          select: assignmentFields,

          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.rpmAssignment.count({ where });
        const today = hospitalToday();

        return {
          items: items.map((assignment) => ({
            ...assignment,
            status: assignmentStatus(assignment, today),
          })),

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

  async detail(actorId: string, assignmentId: string) {
    return this.database.$transaction(
      async (tx) => {
        const scope = await this.accessScope(tx, actorId);

        const assignment = await tx.rpmAssignment.findFirst({
          where: {
            AND: [{ id: assignmentId }, scope],
          },

          select: assignmentFields,
        });

        if (!assignment) {
          throw new NotFoundException(
            'RPM assignment not found or unavailable.',
          );
        }

        return {
          ...assignment,
          status: assignmentStatus(assignment, hospitalToday()),
          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  async readings(
    actorId: string,
    assignmentId: string,
    query: ListSimpleRpmDto,
  ) {
    return this.database.$transaction(
      async (tx) => {
        const scope = await this.accessScope(tx, actorId);

        const assignment = await tx.rpmAssignment.findFirst({
          where: {
            AND: [{ id: assignmentId }, scope],
          },

          select: assignmentFields,
        });

        if (!assignment) {
          throw new NotFoundException(
            'RPM assignment not found or unavailable.',
          );
        }

        const where = {
          assignmentId: assignment.id,
        };

        const items = await tx.rpmReading.findMany({
          where,

          select: {
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
          },

          orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.rpmReading.count({ where });

        return {
          assignment: {
            ...assignment,
            status: assignmentStatus(assignment, hospitalToday()),
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
