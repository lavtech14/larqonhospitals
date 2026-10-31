import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

import type { PatientVisitsPageDto } from './patient-visits.dto.js';

const visitFields = {
  id: true,
  status: true,
  checkedInAt: true,
  readyForDoctorAt: true,
  startedAt: true,
  completedAt: true,

  appointment: {
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      mode: true,

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
  },

  publishedSummary: {
    select: {
      publishedAt: true,
    },
  },
} satisfies Prisma.EncounterSelect;

const summaryFields = {
  id: true,
  patientName: true,
  patientMrn: true,
  doctorName: true,
  doctorRegistrationNumber: true,
  doctorRegistrationAuthority: true,

  summary: true,
  carePlan: true,
  followUp: true,
  returnPrecautions: true,
  publishedAt: true,
} satisfies Prisma.PublishedVisitSummarySelect;

const prescriptionListFields = {
  id: true,
  version: true,
  status: true,
  issuedAt: true,

  patientName: true,
  patientMrn: true,

  prescriberName: true,
  prescriberRegistrationNumber: true,
  prescriberRegistrationAuthority: true,
} satisfies Prisma.PrescriptionSelect;

const prescriptionFields = {
  ...prescriptionListFields,

  allergyStatus: true,
  allergyDetails: true,
  instructions: true,

  items: {
    orderBy: {
      position: 'asc',
    },

    select: {
      id: true,
      position: true,

      medicineName: true,
      genericName: true,
      strength: true,
      dosageForm: true,

      dose: true,
      route: true,
      frequency: true,
      duration: true,
      quantity: true,
      quantityUnit: true,
      instructions: true,
    },
  },
} satisfies Prisma.PrescriptionSelect;

function pagination(query: PatientVisitsPageDto, total: number) {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

@Injectable()
export class PatientVisitsService {
  constructor(private readonly database: DatabaseService) {}

  private readTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.database.$transaction(work, {
      isolationLevel: 'RepeatableRead',
      maxWait: 5000,
      timeout: 15000,
    });
  }

  private async patientId(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<string> {
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

    if (!account?.isActive || account.mustChangePassword) {
      throw new UnauthorizedException(
        'Patient account is unavailable or requires a password change.',
      );
    }

    return account.patientId;
  }

  private async ownedVisit(
    tx: Prisma.TransactionClient,
    accountId: string,
    encounterId: string,
  ) {
    const patientId = await this.patientId(tx, accountId);

    const visit = await tx.encounter.findFirst({
      where: {
        id: encounterId,

        appointment: {
          is: {
            patientId,
          },
        },
      },

      select: visitFields,
    });

    // Same response for an unknown ID and another patient's visit.
    if (!visit) {
      throw new NotFoundException('Visit not found.');
    }

    return visit;
  }

  list(accountId: string, query: PatientVisitsPageDto) {
    return this.readTransaction(async (tx) => {
      const patientId = await this.patientId(tx, accountId);

      const where = {
        appointment: {
          is: {
            patientId,
          },
        },
      } satisfies Prisma.EncounterWhereInput;

      const items = await tx.encounter.findMany({
        where,
        select: visitFields,

        orderBy: [
          {
            checkedInAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });

      const total = await tx.encounter.count({
        where,
      });

      return {
        items,
        pagination: pagination(query, total),
        timeZone: 'Asia/Kolkata',
      };
    });
  }

  detail(accountId: string, encounterId: string) {
    return this.readTransaction(async (tx) => {
      const visit = await this.ownedVisit(tx, accountId, encounterId);

      const vitalCount = await tx.vitalObservation.count({
        where: {
          encounterId: visit.id,
        },
      });

      const issuedPrescriptionCount = await tx.prescription.count({
        where: {
          encounterId: visit.id,
          status: 'ISSUED',
          issuedAt: {
            not: null,
          },
        },
      });

      return {
        visit,

        records: {
          vitalCount,
          issuedPrescriptionCount,
          summaryPublished: visit.publishedSummary !== null,
        },

        timeZone: 'Asia/Kolkata',
      };
    });
  }

  vitals(accountId: string, encounterId: string, query: PatientVisitsPageDto) {
    return this.readTransaction(async (tx) => {
      const visit = await this.ownedVisit(tx, accountId, encounterId);

      const where = {
        encounterId: visit.id,
      } satisfies Prisma.VitalObservationWhereInput;

      const rows = await tx.vitalObservation.findMany({
        where,

        select: {
          id: true,
          measuredAt: true,
          recordedAt: true,

          temperatureC: true,
          pulseBpm: true,
          respiratoryRate: true,
          systolicBp: true,
          diastolicBp: true,
          oxygenSaturation: true,
          weightKg: true,
          heightCm: true,
        },

        orderBy: [
          {
            measuredAt: 'desc',
          },
          {
            recordedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });

      const total = await tx.vitalObservation.count({
        where,
      });

      return {
        visitId: visit.id,

        items: rows.map((row) => ({
          ...row,

          temperatureC:
            row.temperatureC === null ? null : Number(row.temperatureC),

          oxygenSaturation:
            row.oxygenSaturation === null ? null : Number(row.oxygenSaturation),

          weightKg: row.weightKg === null ? null : Number(row.weightKg),

          heightCm: row.heightCm === null ? null : Number(row.heightCm),
        })),

        units: {
          temperatureC: '°C',
          pulseBpm: 'beats/min',
          respiratoryRate: 'breaths/min',
          systolicBp: 'mmHg',
          diastolicBp: 'mmHg',
          oxygenSaturation: '%',
          weightKg: 'kg',
          heightCm: 'cm',
        },

        pagination: pagination(query, total),
        timeZone: 'Asia/Kolkata',
      };
    });
  }

  summary(accountId: string, encounterId: string) {
    return this.readTransaction(async (tx) => {
      const visit = await this.ownedVisit(tx, accountId, encounterId);

      const summary = await tx.publishedVisitSummary.findUnique({
        where: {
          encounterId: visit.id,
        },

        select: summaryFields,
      });

      return {
        visitId: visit.id,
        published: summary !== null,
        summary,
        timeZone: 'Asia/Kolkata',
      };
    });
  }

  prescriptions(
    accountId: string,
    encounterId: string,
    query: PatientVisitsPageDto,
  ) {
    return this.readTransaction(async (tx) => {
      const visit = await this.ownedVisit(tx, accountId, encounterId);

      const where = {
        encounterId: visit.id,
        status: 'ISSUED',

        issuedAt: {
          not: null,
        },
      } satisfies Prisma.PrescriptionWhereInput;

      const items = await tx.prescription.findMany({
        where,
        select: prescriptionListFields,

        orderBy: [
          {
            issuedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });

      const total = await tx.prescription.count({
        where,
      });

      return {
        visitId: visit.id,
        items,
        pagination: pagination(query, total),
        timeZone: 'Asia/Kolkata',
      };
    });
  }

  prescription(accountId: string, encounterId: string, prescriptionId: string) {
    return this.readTransaction(async (tx) => {
      const visit = await this.ownedVisit(tx, accountId, encounterId);

      const prescription = await tx.prescription.findFirst({
        where: {
          id: prescriptionId,
          encounterId: visit.id,
          status: 'ISSUED',

          issuedAt: {
            not: null,
          },
        },

        select: prescriptionFields,
      });

      if (!prescription) {
        throw new NotFoundException('Issued prescription not found.');
      }

      return {
        visitId: visit.id,

        prescription: {
          ...prescription,

          items: prescription.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
          })),
        },

        timeZone: 'Asia/Kolkata',
      };
    });
  }
}
