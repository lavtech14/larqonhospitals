import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreateDepartmentDto,
  ListDepartmentsDto,
  UpdateDepartmentDto,
} from './department.dto.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const departmentFields = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepartmentSelect;

@Injectable()
export class DepartmentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateDepartmentDto, actorStaffId: string) {
    try {
      return await this.database.$transaction(async (tx) => {
        const department = await tx.department.create({
          data: {
            code: dto.code,
            name: dto.name,
          },
          select: departmentFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'DEPARTMENT_CREATED',
            resourceType: 'Department',
            resourceId: department.id,
          },
        });

        return { department };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A department with this code already exists.',
        );
      }

      throw error;
    }
  }

  async list(query: ListDepartmentsDto) {
    const [items, total] = await this.database.$transaction(
      [
        this.database.department.findMany({
          select: departmentFields,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.department.count(),
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
  async findOne(id: string) {
    const department = await this.database.department.findUnique({
      where: { id },
      select: departmentFields,
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    return { department };
  }

  async update(id: string, dto: UpdateDepartmentDto, actorStaffId: string) {
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException(
        'Provide a department name or active status to update.',
      );
    }

    return this.database.$transaction(async (tx) => {
      const existing = await tx.department.findUnique({
        where: { id },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Department not found.');
      }

      const updated = await tx.department.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'DEPARTMENT_VERSION_CONFLICT',
          message:
            'This department changed. Reload it and review your changes before saving again.',
        });
      }

      const department = await tx.department.findUniqueOrThrow({
        where: { id },
        select: departmentFields,
      });

      let action = 'DEPARTMENT_UPDATED';

      if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
        action = dto.isActive
          ? 'DEPARTMENT_ACTIVATED'
          : 'DEPARTMENT_DEACTIVATED';
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action,
          resourceType: 'Department',
          resourceId: id,
        },
      });

      return { department };
    });
  }
}
