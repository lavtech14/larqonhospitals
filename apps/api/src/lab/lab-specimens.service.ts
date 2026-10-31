import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type { LabQueueDto, RejectLabSampleDto } from './lab.dto.js';

const rejectionFields = {
  id: true,
  sampleId: true,
  reason: true,
  rejectedAt: true,
} satisfies Prisma.LabSampleRejectionSelect;

@Injectable()
export class LabSpecimensService {
  constructor(private readonly database: DatabaseService) {}

  queue(query: LabQueueDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, '\\$&');

    const where = {
      currentOrderItem: {
        isNot: null,
      },

      rejection: {
        is: null,
      },

      resultRevisions: {
        none: {},
      },

      releasedReport: {
        is: null,
      },

      orderItem: {
        is: {
          order: {
            is: {
              status: {
                in: ['ORDERED', 'COLLECTED'],
              },

              ...(search
                ? {
                    OR: [
                      {
                        patientName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        patientMrn: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
          },
        },
      },
    } satisfies Prisma.LabSampleWhereInput;

    return this.database.$transaction(
      async (tx) => {
        const items = await tx.labSample.findMany({
          where,

          select: {
            id: true,
            version: true,
            specimenReference: true,
            collectedAt: true,

            orderItem: {
              select: {
                testName: true,
                sampleType: true,

                order: {
                  select: {
                    id: true,
                    version: true,
                    patientName: true,
                    patientMrn: true,
                  },
                },
              },
            },
          },

          orderBy: [{ collectedAt: 'asc' }, { id: 'asc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });

        const total = await tx.labSample.count({ where });

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

  reject(
    sampleId: string,
    actorId: string,
    key: string,
    dto: RejectLabSampleDto,
  ) {
    const reason = dto.reason.trim();

    return this.database.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
        `;

        const sample = await tx.labSample.findUnique({
          where: {
            id: sampleId,
          },

          select: {
            id: true,
            version: true,

            currentOrderItem: {
              select: {
                id: true,
              },
            },

            rejection: {
              select: {
                id: true,
              },
            },

            releasedReport: {
              select: {
                id: true,
              },
            },

            _count: {
              select: {
                resultRevisions: true,
              },
            },

            orderItem: {
              select: {
                id: true,

                order: {
                  select: {
                    id: true,
                    version: true,
                    status: true,
                  },
                },
              },
            },
          },
        });

        if (!sample) {
          throw new NotFoundException('Specimen not found.');
        }

        const requestHash = createHash('sha256')
          .update(
            JSON.stringify({
              sampleId: sample.id,
              expectedSampleVersion: dto.expectedSampleVersion,
              expectedOrderVersion: dto.expectedOrderVersion,
              reason,
              rejectionConfirmed: dto.rejectionConfirmed,
            }),
          )
          .digest('hex');

        const previous = await tx.labSampleRejection.findUnique({
          where: {
            rejectedByStaffId_idempotencyKey: {
              rejectedByStaffId: actorId,
              idempotencyKey: key.toLowerCase(),
            },
          },

          select: {
            id: true,
            requestHash: true,
          },
        });

        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException(
              'This request key was used for a different rejection.',
            );
          }

          return {
            replayed: true,

            rejection: await tx.labSampleRejection.findUniqueOrThrow({
              where: {
                id: previous.id,
              },
              select: rejectionFields,
            }),
          };
        }

        const order = sample.orderItem.order;

        if (
          sample.rejection ||
          sample.currentOrderItem?.id !== sample.orderItem.id
        ) {
          throw new ConflictException(
            'This is no longer the current specimen.',
          );
        }

        if (sample.releasedReport || sample._count.resultRevisions > 0) {
          throw new ConflictException(
            'Specimens with saved results or a released report require a separate correction workflow.',
          );
        }

        if (!['ORDERED', 'COLLECTED'].includes(order.status)) {
          throw new ConflictException(
            'The current order status does not allow rejection.',
          );
        }

        if (
          sample.version !== dto.expectedSampleVersion ||
          order.version !== dto.expectedOrderVersion
        ) {
          throw new ConflictException(
            'The specimen or order changed. Refresh before rejecting.',
          );
        }

        const unlinked = await tx.labOrderItem.updateMany({
          where: {
            id: sample.orderItem.id,
            currentSampleId: sample.id,
          },

          data: {
            currentSampleId: null,
          },
        });

        const sampleUpdated = await tx.labSample.updateMany({
          where: {
            id: sample.id,
            version: dto.expectedSampleVersion,
          },

          data: {
            version: {
              increment: 1,
            },
          },
        });

        const orderUpdated = await tx.labOrder.updateMany({
          where: {
            id: order.id,
            version: dto.expectedOrderVersion,
            status: {
              in: ['ORDERED', 'COLLECTED'],
            },
          },

          data: {
            status: 'ORDERED',

            version: {
              increment: 1,
            },
          },
        });

        if (
          unlinked.count !== 1 ||
          sampleUpdated.count !== 1 ||
          orderUpdated.count !== 1
        ) {
          throw new ConflictException(
            'The specimen changed. Refresh before rejecting.',
          );
        }

        const rejection = await tx.labSampleRejection.create({
          data: {
            sampleId: sample.id,
            rejectedByStaffId: actorId,
            reason,
            idempotencyKey: key.toLowerCase(),
            requestHash,
          },

          select: rejectionFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: actorId,
            action: 'LAB_SAMPLE_REJECTED',
            resourceType: 'LabSample',
            resourceId: sample.id,
          },
        });

        return {
          replayed: false,
          rejection,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }
}
