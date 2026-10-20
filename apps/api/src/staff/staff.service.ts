import { ConflictException, Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword } from '../auth/password.js';
import type { CreateStaffDto, ListStaffDto } from './staff.dto.js';

const staffFields = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,

  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  state: true,
  postalCode: true,
  countryCode: true,

  createdAt: true,
  updatedAt: true,

  roles: {
    select: {
      role: true,
    },
  },

  doctorProfile: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.StaffUserSelect;

type StaffRecord = Prisma.StaffUserGetPayload<{
  select: typeof staffFields;
}>;

function serializeStaff(user: StaffRecord) {
  return {
    ...user,
    roles: user.roles.map((assignment) => assignment.role),
  };
}

@Injectable()
export class StaffService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateStaffDto, actorStaffId: string) {
    // Hash before opening the transaction.
    const passwordHash = await hashPassword(dto.temporaryPassword);

    try {
      return await this.database.$transaction(async (tx) => {
        const user = await tx.staffUser.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            passwordHash,
            isActive: true,
            mustChangePassword: true,

            addressLine1: dto.addressLine1 || null,
            addressLine2: dto.addressLine2 || null,
            city: dto.city || null,
            district: dto.district || null,
            state: dto.state || null,
            postalCode: dto.postalCode || null,
            countryCode: dto.countryCode ?? null,

            roles: {
              create: dto.roles.map((role) => ({ role })),
            },
          },
          select: staffFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'STAFF_ACCOUNT_CREATED',
            resourceType: 'StaffUser',
            resourceId: user.id,
          },
        });

        return {
          user: serializeStaff(user),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'STAFF_EMAIL_EXISTS',
          message: 'A staff account already uses this email address.',
        });
      }

      throw error;
    }
  }

  async list(query: ListStaffDto) {
    const search = query.search?.replace(/[\\%_]/g, '\\$&');

    const where = {
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),

      ...(query.role
        ? {
            roles: {
              some: {
                role: query.role,
              },
            },
          }
        : {}),

      ...(query.status
        ? {
            isActive: query.status === 'active',
          }
        : {}),
    } satisfies Prisma.StaffUserWhereInput;

    const [items, total] = await this.database.$transaction(
      [
        this.database.staffUser.findMany({
          where,
          select: staffFields,
          orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.staffUser.count({ where }),
      ],
      {
        isolationLevel: 'RepeatableRead',
      },
    );

    return {
      items: items.map(serializeStaff),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
