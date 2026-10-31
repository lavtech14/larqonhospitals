import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { Prisma } from "../generated/prisma/client.js";

import type { LabResultsPageDto } from "./lab-results.dto.js";

const reportListFields = {
  id: true,
  testCode: true,
  testName: true,
  specimenReference: true,
  reviewerName: true,
  releasedAt: true,
} satisfies Prisma.LabReleasedReportSelect;

const reportFields = {
  values: true,
  ...reportListFields,

  patientName: true,
  patientMrn: true,
  doctorName: true,

  sampleType: true,
  collectedAt: true,

  method: true,
  resultText: true,
  comments: true,
} satisfies Prisma.LabReleasedReportSelect;

@Injectable()
export class LabReportAccessService {
  constructor(private readonly database: DatabaseService) {}

  private read<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(work, {
      isolationLevel: "RepeatableRead",
      timeout: 15000,
    });
  }

  private async doctorEncounter(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    actorId: string,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,

        doctor: {
          is: {
            staffUserId: actorId,
            isActive: true,

            department: {
              is: {
                isActive: true,
              },
            },
          },
        },
      },

      select: {
        encounter: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException("Assigned appointment not found.");
    }

    return appointment.encounter?.id ?? null;
  }

  private async patientEncounter(
    tx: Prisma.TransactionClient,
    encounterId: string,
    accountId: string,
  ) {
    const account = await tx.patientAccount.findUnique({
      where: {
        id: accountId,
      },

      select: {
        patientId: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!account?.isActive) {
      throw new UnauthorizedException("Patient account is unavailable.");
    }

    if (account.mustChangePassword) {
      throw new ForbiddenException({
        code: "PATIENT_PASSWORD_CHANGE_REQUIRED",
        message: "Change your temporary password first.",
      });
    }

    const encounter = await tx.encounter.findFirst({
      where: {
        id: encounterId,

        appointment: {
          is: {
            patientId: account.patientId,
          },
        },
      },

      select: {
        id: true,
      },
    });

    if (!encounter) {
      throw new NotFoundException("Visit not found.");
    }

    return encounter.id;
  }

  private async listFor(
    tx: Prisma.TransactionClient,
    encounterId: string | null,
    query: LabResultsPageDto,
  ) {
    if (!encounterId) {
      return {
        items: [],

        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where = {
      sample: {
        is: {
          orderItem: {
            is: {
              order: {
                is: {
                  encounterId,
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.LabReleasedReportWhereInput;

    const items = await tx.labReleasedReport.findMany({
      where,
      select: reportListFields,

      orderBy: [{ releasedAt: "desc" }, { id: "desc" }],

      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const total = await tx.labReleasedReport.count({
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
    };
  }

  private async getFor(
    tx: Prisma.TransactionClient,
    encounterId: string | null,
    reportId: string,
  ) {
    if (!encounterId) {
      throw new NotFoundException("Released report not found.");
    }

    const report = await tx.labReleasedReport.findFirst({
      where: {
        id: reportId,

        sample: {
          is: {
            orderItem: {
              is: {
                order: {
                  is: {
                    encounterId,
                  },
                },
              },
            },
          },
        },
      },

      select: reportFields,
    });

    if (!report) {
      throw new NotFoundException("Released report not found.");
    }

    return {
      report,
      timeZone: "Asia/Kolkata",
    };
  }

  doctorList(appointmentId: string, actorId: string, query: LabResultsPageDto) {
    return this.read(async (tx) => {
      const encounterId = await this.doctorEncounter(
        tx,
        appointmentId,
        actorId,
      );

      return this.listFor(tx, encounterId, query);
    });
  }

  doctorReport(appointmentId: string, reportId: string, actorId: string) {
    return this.read(async (tx) => {
      const encounterId = await this.doctorEncounter(
        tx,
        appointmentId,
        actorId,
      );

      return this.getFor(tx, encounterId, reportId);
    });
  }

  patientList(
    encounterId: string,
    accountId: string,
    query: LabResultsPageDto,
  ) {
    return this.read(async (tx) => {
      const ownedId = await this.patientEncounter(tx, encounterId, accountId);

      return this.listFor(tx, ownedId, query);
    });
  }

  patientReport(encounterId: string, reportId: string, accountId: string) {
    return this.read(async (tx) => {
      const ownedId = await this.patientEncounter(tx, encounterId, accountId);

      return this.getFor(tx, ownedId, reportId);
    });
  }
}
