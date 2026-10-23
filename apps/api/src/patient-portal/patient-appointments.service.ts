import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ListOwnAppointmentsDto } from '../appointments/list-own-appointments.dto.js';

const DAY_MS = 86_400_000;

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

@Injectable()
export class PatientAppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(accountId: string, query: ListOwnAppointmentsDto) {
    const fromDate = calendarDate(query.from);
    const toDate = calendarDate(query.to);

    const difference = (toDate.getTime() - fromDate.getTime()) / DAY_MS;

    if (difference < 0 || difference > 30) {
      throw new BadRequestException(
        'Choose an ordered date range containing no more than 31 dates.',
      );
    }

    const from = new Date(`${query.from}T00:00:00+05:30`);

    const until = new Date(
      new Date(`${query.to}T00:00:00+05:30`).getTime() + DAY_MS,
    );

    return this.database.$transaction(
      async (tx) => {
        const account = await tx.patientAccount.findUnique({
          where: { id: accountId },
          select: {
            patientId: true,
            isActive: true,
          },
        });

        if (!account?.isActive) {
          throw new UnauthorizedException('Patient account is unavailable.');
        }

        const where = {
          patientId: account.patientId,
          startsAt: {
            gte: from,
            lt: until,
          },
          ...(query.status ? { status: query.status } : {}),
        } satisfies Prisma.AppointmentWhereInput;

        const items = await tx.appointment.findMany({
          where,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            mode: true,
            consultationEndedAt: true,
            doctor: {
              select: {
                displayName: true,
                specialty: true,
                department: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        const total = await tx.appointment.count({ where });

        return {
          items,
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
