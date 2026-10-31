import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type {
  CreateMedicineDto,
  ListMedicinesDto,
  SearchMedicinesDto,
  UpdateMedicineDto,
} from "./medicine.dto.js";

const medicineFields = {
  id: true,
  code: true,
  displayName: true,
  genericName: true,
  strength: true,
  dosageForm: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicineSelect;

function medicineData(dto: CreateMedicineDto) {
  return {
    code: dto.code.trim().toUpperCase(),
    displayName: dto.displayName.trim(),
    genericName: dto.genericName?.trim() || null,
    strength: dto.strength.trim(),
    dosageForm: dto.dosageForm.trim(),
  };
}

function handleWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictException("A medicine with this code already exists.");
  }

  throw error;
}

@Injectable()
export class MedicinesService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: ListMedicinesDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, "\\$&");

    const where = {
      ...(query.active === "all" ? {} : { isActive: query.active === "true" }),

      ...(search
        ? {
            OR: [
              {
                displayName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                genericName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                code: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.MedicineWhereInput;

    const [items, total] = await this.database.$transaction(
      [
        this.database.medicine.findMany({
          where,
          select: medicineFields,
          orderBy: [{ displayName: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.medicine.count({ where }),
      ],
      {
        isolationLevel: "RepeatableRead",
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

  async search(query: SearchMedicinesDto) {
    const search = query.search.trim().replace(/[\\%_]/g, "\\$&");
    const items = await this.database.medicine.findMany({
      where: {
        isActive: true,
        OR: [
          { displayName: { contains: search, mode: "insensitive" } },
          { genericName: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        code: true,
        displayName: true,
        genericName: true,
        strength: true,
        dosageForm: true,
        isActive: true,
        version: true,
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: query.limit,
    });
    return { items };
  }

  async get(id: string) {
    const medicine = await this.database.medicine.findUnique({
      where: { id },
      select: medicineFields,
    });

    if (!medicine) {
      throw new NotFoundException("Medicine not found.");
    }

    return medicine;
  }

  async create(dto: CreateMedicineDto, actorStaffId: string) {
    try {
      return await this.database.$transaction(async (tx) => {
        const medicine = await tx.medicine.create({
          data: medicineData(dto),
          select: medicineFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: "MEDICINE_CREATED",
            resourceType: "Medicine",
            resourceId: medicine.id,
          },
        });

        return medicine;
      });
    } catch (error) {
      handleWriteError(error);
    }
  }

  async update(id: string, dto: UpdateMedicineDto, actorStaffId: string) {
    try {
      return await this.database.$transaction(async (tx) => {
        const existing = await tx.medicine.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException("Medicine not found.");
        }

        const updated = await tx.medicine.updateMany({
          where: {
            id,
            version: dto.expectedVersion,
          },
          data: {
            ...medicineData(dto),
            isActive: dto.isActive,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: "MEDICINE_VERSION_CONFLICT",
            message: "This medicine changed. Refresh before saving.",
          });
        }

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: "MEDICINE_UPDATED",
            resourceType: "Medicine",
            resourceId: id,
          },
        });

        return tx.medicine.findUniqueOrThrow({
          where: { id },
          select: medicineFields,
        });
      });
    } catch (error) {
      handleWriteError(error);
    }
  }
}
