import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CheckInDto } from './check-in.dto.js';
import { hospitalDate, hospitalDayBounds } from './encounter-time.js';
import type { ListNursingQueueDto } from './list-nursing-queue.dto.js';
import type { MarkReadyDto } from './mark-ready.dto.js';

const encounterFields = {
  id: true,
  appointmentId: true,
  status: true,
  checkedInAt: true,
  checkedInByStaffId: true,
  readyForDoctorAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  version: true,
} satisfies Prisma.EncounterSelect;

@Injectable()
export class EncountersService {
  constructor(private readonly database: DatabaseService) {}

  async checkIn(appointmentId: string, dto: CheckInDto, actorStaffId: string) {
    return this.database.$transaction(
      async (tx) => {
        // Same hospital lock as booking/cancellation. Keep the text cast:
        // PostgreSQL advisory-lock functions return void, unsupported by Prisma.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const appointment = await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            id: true,
            status: true,
            mode: true,
            startsAt: true,
            version: true,
            consultationEndedAt: true,
            doctor: {
              select: {
                isActive: true,
                department: { select: { isActive: true } },
              },
            },
            encounter: { select: encounterFields },
          },
        });

        if (!appointment) {
          throw new NotFoundException('Appointment not found.');
        }

        // Reject invalid bookings even on replay. An existing encounter never
        // creates a second visit or resets its status/timestamps.
        if (appointment.status !== 'BOOKED') {
          throw new ConflictException({
            code: 'APPOINTMENT_NOT_BOOKED',
            message: 'A cancelled appointment cannot be checked in.',
          });
        }
        if (appointment.mode !== 'IN_PERSON') {
          throw new ConflictException({
            code: 'IN_PERSON_APPOINTMENT_REQUIRED',
            message:
              'Reception check-in currently supports in-person appointments only.',
          });
        }

        if (appointment.encounter) {
          return {
            alreadyCheckedIn: true,
            appointment: { id: appointment.id, version: appointment.version },
            encounter: appointment.encounter,
          };
        }

        if (appointment.consultationEndedAt) {
          throw new ConflictException('This consultation has already ended.');
        }

        if (appointment.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: 'APPOINTMENT_VERSION_CONFLICT',
            message: 'This appointment changed. Refresh before checking in.',
          });
        }

        const now = new Date();
        if (hospitalDate(appointment.startsAt) !== hospitalDate(now)) {
          throw new ConflictException({
            code: 'CHECK_IN_DATE_MISMATCH',
            message:
              'Check-in is available only on the appointment date in Asia/Kolkata.',
          });
        }

        if (
          !appointment.doctor.isActive ||
          !appointment.doctor.department.isActive
        ) {
          throw new ConflictException('The doctor or department is inactive.');
        }

        // Compare-and-swap also catches writers that do not take our lock.
        const updated = await tx.appointment.updateMany({
          where: {
            id: appointmentId,
            version: dto.expectedVersion,
            status: 'BOOKED',
            mode: 'IN_PERSON',
            consultationEndedAt: null,
          },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'APPOINTMENT_VERSION_CONFLICT',
            message: 'This appointment changed. Refresh before checking in.',
          });
        }

        const encounter = await tx.encounter.create({
          data: {
            appointmentId,
            checkedInByStaffId: actorStaffId,
            checkedInAt: now,
          },
          select: encounterFields,
        });
        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'ENCOUNTER_CHECKED_IN',
            resourceType: 'Encounter',
            resourceId: encounter.id,
          },
        });

        return {
          alreadyCheckedIn: false,
          appointment: { id: appointment.id, version: dto.expectedVersion + 1 },
          encounter,
        };
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 15_000 },
    );
  }

  async listQueue(query: ListNursingQueueDto) {
    const { date, from, until } = hospitalDayBounds(new Date());
    const where = {
      status: query.status ?? { in: ['CHECKED_IN', 'READY_FOR_DOCTOR'] },
      appointment: {
        is: {
          status: 'BOOKED',
          mode: 'IN_PERSON',
          startsAt: { gte: from, lt: until },
          ...(query.doctorId ? { doctorId: query.doctorId } : {}),
          ...(query.departmentId
            ? { doctor: { is: { departmentId: query.departmentId } } }
            : {}),
        },
      },
    } satisfies Prisma.EncounterWhereInput;

    const [items, total] = await this.database.$transaction(
      [
        this.database.encounter.findMany({
          where,
          // FIFO by actual arrival, with stable ordering for pagination.
          orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            ...encounterFields,
            appointment: {
              select: {
                id: true,
                version: true,
                startsAt: true,
                endsAt: true,
                patient: { select: { id: true, mrn: true, fullName: true } },
                doctor: {
                  select: {
                    id: true,
                    displayName: true,
                    department: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        }),
        this.database.encounter.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );

    return {
      date,
      timeZone: 'Asia/Kolkata',
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async markReady(
    encounterId: string,
    dto: MarkReadyDto,
    actorStaffId: string,
  ) {
    return this.database.$transaction(
      async (tx) => {
        // Same lock used by check-in, cancellation and vitals saves.
        await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
      `;

        const encounter = await tx.encounter.findUnique({
          where: { id: encounterId },
          select: {
            ...encounterFields,
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

        if (
          encounter.appointment.status !== 'BOOKED' ||
          encounter.appointment.mode !== 'IN_PERSON'
        ) {
          throw new ConflictException(
            'This appointment is unavailable for the nursing workflow.',
          );
        }

        // A retry must not change the timestamp or create another audit.
        if (encounter.status === 'READY_FOR_DOCTOR') {
          const current = await tx.encounter.findUniqueOrThrow({
            where: { id: encounterId },
            select: encounterFields,
          });

          return {
            alreadyReady: true,
            encounter: current,
          };
        }

        if (encounter.status !== 'CHECKED_IN') {
          throw new ConflictException({
            code: 'ENCOUNTER_NOT_WAITING_FOR_NURSE',
            message:
              'Only a checked-in encounter can be marked ready for the doctor.',
          });
        }

        if (encounter.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: 'ENCOUNTER_VERSION_CONFLICT',
            message: 'This encounter changed. Refresh before marking it ready.',
          });
        }

        const reading = await tx.vitalObservation.findFirst({
          where: { encounterId },
          select: { id: true },
        });

        if (!reading) {
          throw new ConflictException({
            code: 'VITALS_REQUIRED',
            message:
              'Save at least one measurement set before marking this visit ready.',
          });
        }

        const updated = await tx.encounter.updateMany({
          where: {
            id: encounterId,
            version: dto.expectedVersion,
            status: 'CHECKED_IN',
          },
          data: {
            status: 'READY_FOR_DOCTOR',
            readyForDoctorAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'ENCOUNTER_VERSION_CONFLICT',
            message: 'This encounter changed. Refresh and try again.',
          });
        }

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'ENCOUNTER_READY_FOR_DOCTOR',
            resourceType: 'Encounter',
            resourceId: encounterId,
          },
        });

        const readyEncounter = await tx.encounter.findUniqueOrThrow({
          where: { id: encounterId },
          select: encounterFields,
        });

        return {
          alreadyReady: false,
          encounter: readyEncounter,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }
}
