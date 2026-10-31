import { normalizeParameters } from "../lab-shared/structured-results.js";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type {
  CreateLabTestDto,
  ListLabTestsDto,
  UpdateLabTestDto,
} from "./lab-test.dto.js";

const labTestFields = {
  id: true,
  parameters: true,
  code: true,
  displayName: true,
  sampleType: true,
  preparationInstructions: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LabTestSelect;

function normalized(dto: CreateLabTestDto) {
  return {
    parameters: normalizeParameters(dto.parameters),
    code: dto.code.trim().toUpperCase(),
    displayName: dto.displayName.trim(),
    sampleType: dto.sampleType.trim(),

    preparationInstructions: dto.preparationInstructions?.trim() || null,
  };
}

function duplicateCode(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class LabTestsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: ListLabTestsDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, "\\$&");

    const where = {
      ...(query.active === "all"
        ? {}
        : {
            isActive: query.active === "true",
          }),

      ...(search
        ? {
            OR: [
              {
                code: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                displayName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                sampleType: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.LabTestWhereInput;

    const [items, total] = await this.database.$transaction(
      [
        this.database.labTest.findMany({
          where,
          select: labTestFields,

          orderBy: [
            {
              displayName: "asc",
            },
            {
              id: "asc",
            },
          ],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),

        this.database.labTest.count({
          where,
        }),
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

  async get(id: string) {
    const test = await this.database.labTest.findUnique({
      where: {
        id,
      },

      select: labTestFields,
    });

    if (!test) {
      throw new NotFoundException("Lab test not found.");
    }

    return test;
  }

  async create(actorId: string, dto: CreateLabTestDto) {
    try {
      return await this.database.$transaction(async (tx) => {
        const test = await tx.labTest.create({
          data: normalized(dto),
          select: labTestFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_TEST_CREATED",
            resourceType: "LabTest",
            resourceId: test.id,
          },
        });

        return test;
      });
    } catch (caught) {
      if (duplicateCode(caught)) {
        throw new ConflictException(
          "A lab test with this code already exists.",
        );
      }

      throw caught;
    }
  }

  async update(id: string, actorId: string, dto: UpdateLabTestDto) {
    try {
      return await this.database.$transaction(async (tx) => {
        const existing = await tx.labTest.findUnique({
          where: {
            id,
          },

          select: {
            id: true,
          },
        });

        if (!existing) {
          throw new NotFoundException("Lab test not found.");
        }

        const updated = await tx.labTest.updateMany({
          where: {
            id,
            version: dto.expectedVersion,
          },

          data: {
            ...normalized(dto),

            isActive: dto.isActive,

            version: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            "This lab test changed. Reload its latest details before saving.",
          );
        }

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_TEST_UPDATED",
            resourceType: "LabTest",
            resourceId: id,
          },
        });

        return tx.labTest.findUniqueOrThrow({
          where: {
            id,
          },

          select: labTestFields,
        });
      });
    } catch (caught) {
      if (duplicateCode(caught)) {
        throw new ConflictException(
          "A lab test with this code already exists.",
        );
      }

      throw caught;
    }
  }
}
