import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type {
  CreateDoctorDto,
  ListDoctorsDto,
  UpdateDoctorDto,
} from './doctor.dto.js';

const doctorFields = {
  id: true,
  displayName: true,
  specialty: true,
  qualification: true,
  isActive: true,
  version: true,
  department: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.DoctorProfileSelect;
const managementFields = {
  ...doctorFields,
  registrationNumber: true,
  registrationAuthority: true,
  staffUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DoctorProfileSelect;

@Injectable()
export class DoctorsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateDoctorDto, actorStaffId: string) {
    try {
      return await this.database.$transaction(async (tx) => {
        // Coordinate with department status updates.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Department"
          WHERE "id" = ${dto.departmentId}::uuid
          FOR UPDATE
        `;

        const department = await tx.department.findUnique({
          where: { id: dto.departmentId },
          select: { isActive: true },
        });

        if (!department) {
          throw new NotFoundException('Department not found.');
        }

        if (!department.isActive) {
          throw new BadRequestException('Choose an active department.');
        }

        if (dto.staffUserId) {
          await tx.$queryRaw`
            SELECT "id"
            FROM "StaffUser"
            WHERE "id" = ${dto.staffUserId}::uuid
            FOR UPDATE
          `;

          const staff = await tx.staffUser.findUnique({
            where: { id: dto.staffUserId },
            select: {
              isActive: true,
              roles: {
                select: { role: true },
              },
            },
          });

          if (
            !staff?.isActive ||
            !staff.roles.some((assignment) => assignment.role === 'DOCTOR')
          ) {
            throw new BadRequestException(
              'The linked staff account must be active and have the Doctor role.',
            );
          }
        }

        const doctor = await tx.doctorProfile.create({
          data: {
            displayName: dto.displayName,
            specialty: dto.specialty,
            qualification: dto.qualification || null,
            registrationNumber: dto.registrationNumber || null,
            registrationAuthority: dto.registrationAuthority || null,
            departmentId: dto.departmentId,
            staffUserId: dto.staffUserId || null,
          },
          select: doctorFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'DOCTOR_PROFILE_CREATED',
            resourceType: 'DoctorProfile',
            resourceId: doctor.id,
          },
        });

        return { doctor };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This staff account already has a doctor profile.',
        );
      }

      throw error;
    }
  }

  async list(query: ListDoctorsDto) {
    const where: Prisma.DoctorProfileWhereInput = query.departmentId
      ? { departmentId: query.departmentId }
      : {};

    const [items, total] = await this.database.$transaction(
      [
        this.database.doctorProfile.findMany({
          where,
          select: doctorFields,
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.doctorProfile.count({ where }),
      ],
      {
        isolationLevel: 'RepeatableRead',
      },
    );

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async findManagementDetails(id: string, actorStaffId: string) {
    return this.database.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.findUnique({
        where: { id },
        select: managementFields,
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found.');
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: 'DOCTOR_PROFILE_MANAGEMENT_VIEWED',
          resourceType: 'DoctorProfile',
          resourceId: id,
        },
      });

      return { doctor };
    });
  }

  async update(id: string, dto: UpdateDoctorDto, actorStaffId: string) {
    const hasChanges = Object.entries(dto).some(
      ([key, value]) => key !== 'expectedVersion' && value !== undefined,
    );

    if (!hasChanges) {
      throw new BadRequestException(
        'Provide at least one doctor-profile field to update.',
      );
    }

    try {
      return await this.database.$transaction(async (tx) => {
        const existing = await tx.doctorProfile.findUnique({
          where: { id },
          select: {
            departmentId: true,
            staffUserId: true,
            isActive: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Doctor profile not found.');
        }

        const departmentId = dto.departmentId ?? existing.departmentId;

        await tx.$queryRaw`
        SELECT "id"
        FROM "Department"
        WHERE "id" = ${departmentId}::uuid
        FOR UPDATE
      `;

        const department = await tx.department.findUnique({
          where: { id: departmentId },
          select: { isActive: true },
        });

        if (!department) {
          throw new NotFoundException('Department not found.');
        }

        const requiresActiveDepartment =
          dto.departmentId !== undefined || dto.isActive === true;

        if (requiresActiveDepartment && !department.isActive) {
          throw new BadRequestException(
            'Choose an active department before assigning or activating this doctor.',
          );
        }

        const staffUserId =
          dto.staffUserId !== undefined
            ? dto.staffUserId || null
            : existing.staffUserId;

        const mustValidateStaff =
          dto.staffUserId !== undefined || dto.isActive === true;

        if (staffUserId && mustValidateStaff) {
          await tx.$queryRaw`
          SELECT "id"
          FROM "StaffUser"
          WHERE "id" = ${staffUserId}::uuid
          FOR UPDATE
        `;

          const staff = await tx.staffUser.findUnique({
            where: { id: staffUserId },
            select: {
              isActive: true,
              roles: {
                select: { role: true },
              },
            },
          });

          if (
            !staff?.isActive ||
            !staff.roles.some((assignment) => assignment.role === 'DOCTOR')
          ) {
            throw new BadRequestException(
              'The linked staff account must be active and have the Doctor role.',
            );
          }
        }

        const updated = await tx.doctorProfile.updateMany({
          where: {
            id,
            version: dto.expectedVersion,
          },
          data: {
            ...(dto.displayName !== undefined
              ? { displayName: dto.displayName }
              : {}),
            ...(dto.specialty !== undefined
              ? { specialty: dto.specialty }
              : {}),
            ...(dto.qualification !== undefined
              ? { qualification: dto.qualification || null }
              : {}),
            ...(dto.registrationNumber !== undefined
              ? { registrationNumber: dto.registrationNumber || null }
              : {}),
            ...(dto.registrationAuthority !== undefined
              ? { registrationAuthority: dto.registrationAuthority || null }
              : {}),
            ...(dto.departmentId !== undefined ? { departmentId } : {}),
            ...(dto.staffUserId !== undefined ? { staffUserId } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'DOCTOR_VERSION_CONFLICT',
            message:
              'This doctor profile changed. Reload it and review your changes before saving again.',
          });
        }

        const doctor = await tx.doctorProfile.findUniqueOrThrow({
          where: { id },
          select: managementFields,
        });

        let action = 'DOCTOR_PROFILE_UPDATED';

        if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
          action = dto.isActive
            ? 'DOCTOR_PROFILE_ACTIVATED'
            : 'DOCTOR_PROFILE_DEACTIVATED';
        }

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action,
            resourceType: 'DoctorProfile',
            resourceId: id,
          },
        });

        return { doctor };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This staff account already has a doctor profile.',
        );
      }

      throw error;
    }
  }
}
