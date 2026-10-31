import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type { CollectLabSampleDto, LabQueueDto } from './lab.dto.js';

const sampleFields = {
  id: true,
  orderItemId: true,
  specimenReference: true,
  collectedAt: true,
  recordedAt: true,
} satisfies Prisma.LabSampleSelect;

@Injectable()
export class LabService {
  constructor(private readonly database: DatabaseService) {}

  async queue(query: LabQueueDto) {
    const search = query.search?.trim().replace(/[\\%_]/g, '\\$&');

    const where = {
      status: 'ORDERED',

      // Only orders with at least one test awaiting a
      // current specimen belong in the collection queue.
      items: {
        some: {
          sample: {
            is: null,
          },
        },
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
    } satisfies Prisma.LabOrderWhereInput;

    return this.database.$transaction(
      async (tx) => {
        const items = await tx.labOrder.findMany({
          where,

          // Oldest pending orders first.
          orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],

          skip: (query.page - 1) * query.limit,
          take: query.limit,

          select: {
            id: true,
            version: true,
            priority: true,
            status: true,
            clinicalReason: true,
            patientName: true,
            patientMrn: true,
            doctorName: true,
            orderedAt: true,

            items: {
              orderBy: {
                position: 'asc',
              },

              select: {
                id: true,
                testCode: true,
                testName: true,
                sampleType: true,
                preparationInstructions: true,

                // Current specimen, if one exists.
                sample: {
                  select: {
                    ...sampleFields,

                    collectedBy: {
                      select: {
                        fullName: true,
                      },
                    },
                  },
                },

                // Latest five rejected attempts.
                // Older attempts remain in the database.
                samples: {
                  where: {
                    rejection: {
                      isNot: null,
                    },
                  },

                  orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],

                  take: 5,

                  select: {
                    id: true,
                    specimenReference: true,

                    rejection: {
                      select: {
                        reason: true,
                        rejectedAt: true,

                        rejectedBy: {
                          select: {
                            fullName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const total = await tx.labOrder.count({
          where,
        });

        return {
          items,

          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },

          timeZone: 'Asia/Kolkata',
        };
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: 15000,
      },
    );
  }

  async collect(
    orderId: string,
    itemId: string,
    actorId: string,
    key: string,
    dto: CollectLabSampleDto,
  ) {
    const specimenReference = dto.specimenReference.trim().toUpperCase();

    const collectedAt = new Date(dto.collectedAt);
    const idempotencyKey = key.toLowerCase();

    if (!Number.isFinite(collectedAt.getTime())) {
      throw new BadRequestException('Invalid collection time.');
    }

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          orderId: orderId.toLowerCase(),
          itemId: itemId.toLowerCase(),
          expectedOrderVersion: dto.expectedOrderVersion,
          specimenReference,
          collectedAt: collectedAt.toISOString(),
          collectionConfirmed: dto.collectionConfirmed,
        }),
      )
      .digest('hex');

    try {
      return await this.database.$transaction(
        async (tx) => {
          // Shared with rejection, result entry,
          // report release, and encounter mutations.
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
          `;

          const order = await tx.labOrder.findUnique({
            where: {
              id: orderId,
            },

            select: {
              id: true,
              status: true,
              version: true,
              orderedAt: true,
            },
          });

          if (!order) {
            throw new NotFoundException('Lab order not found.');
          }

          const item = await tx.labOrderItem.findFirst({
            where: {
              id: itemId,
              orderId: order.id,
            },

            select: {
              id: true,
              currentSampleId: true,
            },
          });

          if (!item) {
            throw new NotFoundException('Ordered test not found.');
          }

          // Resolve the original collection before checking
          // current status. The specimen may subsequently
          // have been rejected or replaced.
          const previous = await tx.labSample.findUnique({
            where: {
              collectedByStaffId_idempotencyKey: {
                collectedByStaffId: actorId,
                idempotencyKey,
              },
            },

            select: {
              ...sampleFields,
              requestHash: true,
            },
          });

          if (previous) {
            if (previous.requestHash !== requestHash) {
              throw new ConflictException(
                'This request key was used for a different collection.',
              );
            }

            return {
              replayed: true,
              orderId: order.id,

              sample: {
                id: previous.id,
                orderItemId: previous.orderItemId,
                specimenReference: previous.specimenReference,
                collectedAt: previous.collectedAt,
                recordedAt: previous.recordedAt,
              },
            };
          }

          if (order.status !== 'ORDERED') {
            throw new ConflictException(
              'This order is not awaiting collection.',
            );
          }

          if (item.currentSampleId !== null) {
            throw new ConflictException(
              'A current specimen already exists for this test. Refresh the queue.',
            );
          }

          if (order.version !== dto.expectedOrderVersion) {
            throw new ConflictException(
              'This order changed. Refresh and review before collecting.',
            );
          }

          const latestRejection = await tx.labSampleRejection.findFirst({
            where: {
              sample: {
                is: {
                  orderItemId: item.id,
                },
              },
            },

            orderBy: [{ rejectedAt: 'desc' }, { id: 'desc' }],

            select: {
              rejectedAt: true,
            },
          });

          const earliestCollectionTime = Math.max(
            order.orderedAt.getTime(),
            latestRejection?.rejectedAt.getTime() ?? 0,
          );

          if (
            collectedAt.getTime() < earliestCollectionTime ||
            collectedAt.getTime() > Date.now() + 60_000
          ) {
            throw new BadRequestException(
              'Collection time must be after the order and any previous specimen rejection, and cannot be in the future.',
            );
          }

          // Always create a separate collection attempt.
          // Previous specimens are never overwritten.
          const sample = await tx.labSample.create({
            data: {
              orderItemId: item.id,
              specimenReference,
              collectedAt,
              collectedByStaffId: actorId,
              idempotencyKey,
              requestHash,
            },

            select: sampleFields,
          });

          const linked = await tx.labOrderItem.updateMany({
            where: {
              id: item.id,
              orderId: order.id,
              currentSampleId: null,
            },

            data: {
              currentSampleId: sample.id,
            },
          });

          if (linked.count !== 1) {
            throw new ConflictException(
              'A current specimen already exists. Refresh before collecting.',
            );
          }

          const remaining = await tx.labOrderItem.count({
            where: {
              orderId: order.id,
              currentSampleId: null,
            },
          });

          const updated = await tx.labOrder.updateMany({
            where: {
              id: order.id,
              status: 'ORDERED',
              version: dto.expectedOrderVersion,
            },

            data: {
              version: {
                increment: 1,
              },

              status: remaining === 0 ? 'COLLECTED' : 'ORDERED',
            },
          });

          if (updated.count !== 1) {
            throw new ConflictException(
              'The order changed. Refresh before collecting.',
            );
          }

          await tx.auditEvent.create({
            data: {
              actorStaffId: actorId,
              action: 'LAB_SAMPLE_COLLECTED',
              resourceType: 'LabSample',
              resourceId: sample.id,
            },
          });

          return {
            replayed: false,
            orderId: order.id,
            sample,
          };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (caught) {
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === 'P2002'
      ) {
        throw new ConflictException(
          'The specimen reference or collection record already exists. Refresh and verify before continuing.',
        );
      }

      throw caught;
    }
  }
}
