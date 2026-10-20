import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { ListClosuresDto, SaveClosureDto } from './closure.dto.js';

const closureFields = {
  id: true,
  date: true,
  isClosed: true,
  version: true,
};

function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Invalid calendar date.');
  }

  return date;
}

function serializeClosure<T extends { date: Date }>(closure: T) {
  return {
    ...closure,
    date: closure.date.toISOString().slice(0, 10),
  };
}

@Injectable()
export class ClosureService {
  constructor(private readonly database: DatabaseService) {}

  async list(doctorId: string | null, query: ListClosuresDto) {
    const from = calendarDate(query.from);
    const to = calendarDate(query.to);

    const days = (to.getTime() - from.getTime()) / 86_400_000;

    if (days < 0 || days > 365) {
      throw new BadRequestException(
        'Choose an ordered date range containing no more than 366 dates.',
      );
    }

    if (doctorId) {
      const doctor = await this.database.doctorProfile.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found.');
      }
    }

    const dateFilter = { gte: from, lte: to };

    const items = doctorId
      ? await this.database.doctorDateClosure.findMany({
          where: { doctorId, date: dateFilter },
          select: closureFields,
          orderBy: { date: 'asc' },
        })
      : await this.database.hospitalDateClosure.findMany({
          where: { date: dateFilter },
          select: closureFields,
          orderBy: { date: 'asc' },
        });

    return {
      timeZone: 'Asia/Kolkata',
      items: items.map(serializeClosure),
    };
  }

  async save(
    doctorId: string | null,
    dto: SaveClosureDto,
    actorStaffId: string,
  ) {
    const date = calendarDate(dto.date);

    return this.database.$transaction(async (tx) => {
      if (doctorId) {
        // Serialize this doctor's calendar changes.
        await tx.$queryRaw`
          SELECT "id"
          FROM "DoctorProfile"
          WHERE "id" = ${doctorId}::uuid
          FOR UPDATE
        `;

        const doctor = await tx.doctorProfile.findUnique({
          where: { id: doctorId },
          select: { id: true },
        });

        if (!doctor) {
          throw new NotFoundException('Doctor profile not found.');
        }
      } else {
        // Serialize hospital-closure writes, including first-time dates.
        await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
`;
      }

      const existing = doctorId
        ? await tx.doctorDateClosure.findUnique({
            where: {
              doctorId_date: { doctorId, date },
            },
            select: closureFields,
          })
        : await tx.hospitalDateClosure.findUnique({
            where: { date },
            select: closureFields,
          });

      if ((existing?.version ?? 0) !== dto.expectedVersion) {
        throw new ConflictException({
          code: 'CLOSURE_VERSION_CONFLICT',
          message: 'This date setting changed. Reload it before saving again.',
        });
      }

      if (dto.isClosed) {
        const dayStart = new Date(`${dto.date}T00:00:00+05:30`);

        const dayEnd = new Date(dayStart.getTime() + 86_400_000);

        const existingBooking = await tx.appointment.findFirst({
          where: {
            status: 'BOOKED',
            ...(doctorId ? { doctorId } : {}),
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: { id: true },
        });

        if (existingBooking) {
          throw new ConflictException({
            code: 'CLOSURE_HAS_BOOKINGS',
            message:
              'This date has booked appointments. Resolve those appointments before closing it.',
          });
        }
      }

      const closure = doctorId
        ? existing
          ? await tx.doctorDateClosure.update({
              where: { id: existing.id },
              data: {
                isClosed: dto.isClosed,
                version: { increment: 1 },
              },
              select: closureFields,
            })
          : await tx.doctorDateClosure.create({
              data: {
                doctorId,
                date,
                isClosed: dto.isClosed,
              },
              select: closureFields,
            })
        : existing
          ? await tx.hospitalDateClosure.update({
              where: { id: existing.id },
              data: {
                isClosed: dto.isClosed,
                version: { increment: 1 },
              },
              select: closureFields,
            })
          : await tx.hospitalDateClosure.create({
              data: {
                date,
                isClosed: dto.isClosed,
              },
              select: closureFields,
            });

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: dto.isClosed
            ? 'CALENDAR_DATE_CLOSED'
            : 'CALENDAR_DATE_REOPENED',
          resourceType: doctorId ? 'DoctorDateClosure' : 'HospitalDateClosure',
          resourceId: closure.id,
        },
      });

      return {
        timeZone: 'Asia/Kolkata',
        closure: serializeClosure(closure),
      };
    });
  }
}
