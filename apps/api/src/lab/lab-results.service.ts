import { buildResultValues } from "../lab-shared/structured-results.js";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { createHash } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type {
  LabResultsPageDto,
  LabResultsQueueDto,
  SaveLabResultDto,
} from "./lab-results.dto.js";

const revisionFields = {
  values: true,
  id: true,
  revision: true,
  method: true,
  resultText: true,
  comments: true,
  createdAt: true,

  author: {
    select: {
      fullName: true,
    },
  },
} satisfies Prisma.LabResultRevisionSelect;

const sampleFields = {
  id: true,
  version: true,
  specimenReference: true,
  collectedAt: true,
  releasedReport: {
    select: {
      id: true,
      releasedAt: true,
    },
  },

  collectedBy: {
    select: {
      fullName: true,
    },
  },

  orderItem: {
    select: {
      parameters: true,
      testCode: true,
      testName: true,
      sampleType: true,

      order: {
        select: {
          id: true,
          status: true,
          priority: true,
          patientName: true,
          patientMrn: true,
          doctorName: true,
          clinicalReason: true,
        },
      },
    },
  },
  currentOrderItem: {
    select: {
      id: true,
    },
  },

  rejection: {
    select: {
      reason: true,
      rejectedAt: true,
    },
  },
} satisfies Prisma.LabSampleSelect;

@Injectable()
export class LabResultsService {
  constructor(private readonly database: DatabaseService) {}

  private async sample(tx: Prisma.TransactionClient, sampleId: string) {
    const sample = await tx.labSample.findUnique({
      where: {
        id: sampleId,
      },

      select: sampleFields,
    });

    if (!sample) {
      throw new NotFoundException("Collected specimen not found.");
    }

    return sample;
  }

  queue(query: LabResultsQueueDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, "\\$&");

    const where = {
      currentOrderItem: {
        isNot: null,
      },

      rejection: {
        is: null,
      },
      // This relation belongs directly to LabSample.
      ...(query.state !== "all"
        ? {
            releasedReport: {
              is: null,
            },
          }
        : {}),

      orderItem: {
        is: {
          order: {
            is: {
              status: {
                in: ["ORDERED", "COLLECTED"],
              },

              ...(search
                ? {
                    OR: [
                      {
                        patientName: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        patientMrn: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
          },
        },
      },

      ...(query.state === "pending"
        ? {
            resultRevisions: {
              none: {},
            },
          }
        : query.state === "drafted"
          ? {
              resultRevisions: {
                some: {},
              },
            }
          : {}),
    } satisfies Prisma.LabSampleWhereInput;

    return this.database.$transaction(
      async (tx) => {
        const rows = await tx.labSample.findMany({
          where,

          select: {
            ...sampleFields,

            resultRevisions: {
              orderBy: {
                revision: "desc",
              },

              take: 1,

              select: {
                revision: true,
                createdAt: true,
              },
            },
          },

          orderBy: [{ collectedAt: "asc" }, { id: "asc" }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.labSample.count({ where });

        return {
          items: rows.map(({ resultRevisions, ...sample }) => ({
            ...sample,
            latestDraft: resultRevisions[0] ?? null,
          })),

          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },
      {
        isolationLevel: "RepeatableRead",
        timeout: 15000,
      },
    );
  }

  read(sampleId: string, query: LabResultsPageDto) {
    return this.database.$transaction(
      async (tx) => {
        const sample = await this.sample(tx, sampleId);

        const where = {
          sampleId: sample.id,
        };

        const latestDraft = await tx.labResultRevision.findFirst({
          where,
          select: revisionFields,
          orderBy: {
            revision: "desc",
          },
        });

        const items = await tx.labResultRevision.findMany({
          where,
          select: revisionFields,

          orderBy: {
            revision: "desc",
          },

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.labResultRevision.count({
          where,
        });

        return {
          sample,
          latestDraft,

          history: {
            items,

            pagination: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: Math.ceil(total / query.limit),
            },
          },
        };
      },
      {
        isolationLevel: "RepeatableRead",
        timeout: 15000,
      },
    );
  }

  save(sampleId: string, actorId: string, key: string, dto: SaveLabResultDto) {
    const document = {
      method: dto.method.trim(),
      resultText: dto.resultText.trim(),
      comments: dto.comments.trim(),
    };

    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const sample = await this.sample(tx, sampleId);
        const values = buildResultValues(
          sample.orderItem.parameters,
          dto.values,
          document.resultText,
        );

        const requestHash = createHash("sha256")
          .update(
            JSON.stringify({
              sampleId: sample.id,
              expectedVersion: dto.expectedVersion,
              ...document,
              values,
            }),
          )
          .digest("hex");

        const previous = await tx.labResultRevision.findUnique({
          where: {
            authorStaffId_idempotencyKey: {
              authorStaffId: actorId,
              idempotencyKey: key.toLowerCase(),
            },
          },

          select: {
            id: true,
            requestHash: true,
          },
        });
        if (!sample.currentOrderItem || sample.rejection) {
          throw new ConflictException(
            "Results cannot be entered for a rejected or superseded specimen.",
          );
        }

        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException(
              "This save key was used for different result details.",
            );
          }

          return {
            replayed: true,

            draft: await tx.labResultRevision.findUniqueOrThrow({
              where: {
                id: previous.id,
              },
              select: revisionFields,
            }),
          };
        }
        if (sample.releasedReport) {
          throw new ConflictException(
            "This report has been released. Draft edits are locked.",
          );
        }

        if (!["ORDERED", "COLLECTED"].includes(sample.orderItem.order.status)) {
          throw new ConflictException(
            "Results cannot be edited for this order status.",
          );
        }

        const updated = await tx.labSample.updateMany({
          where: {
            id: sample.id,
            version: dto.expectedVersion,
          },

          data: {
            version: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            "This specimen result changed. Refresh and review before saving.",
          );
        }

        const latest = await tx.labResultRevision.findFirst({
          where: {
            sampleId: sample.id,
          },

          orderBy: {
            revision: "desc",
          },

          select: {
            revision: true,
          },
        });

        const draft = await tx.labResultRevision.create({
          data: {
            sampleId: sample.id,
            authorStaffId: actorId,
            revision: (latest?.revision ?? 0) + 1,
            ...document,
            values,
            idempotencyKey: key.toLowerCase(),
            requestHash,
          },

          select: revisionFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: "LAB_RESULT_DRAFT_SAVED",
            resourceType: "LabResultRevision",
            resourceId: draft.id,
          },
        });

        return {
          replayed: false,
          draft,
        };
      },
      {
        isolationLevel: "ReadCommitted",
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }
}
