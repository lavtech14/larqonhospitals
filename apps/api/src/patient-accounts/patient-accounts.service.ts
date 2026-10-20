import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword } from '../auth/password.js';
import type { CreatePatientAccountDto } from './create-patient-account.dto.js';

const accountFields = {
  id: true,
  patientId: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  version: true,
  createdAt: true,
} satisfies Prisma.PatientAccountSelect;

@Injectable()
export class PatientAccountsService {
  constructor(private readonly database: DatabaseService) {}

  async get(patientId: string) {
    const patient = await this.database.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        account: {
          select: accountFields,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found.');
    }

    return {
      account: patient.account,
    };
  }

  async create(
    patientId: string,
    dto: CreatePatientAccountDto,
    actorStaffId: string,
  ) {
    const passwordHash = await hashPassword(dto.temporaryPassword);

    try {
      return await this.database.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Patient"
          WHERE "id" = ${patientId}::uuid
          FOR UPDATE
        `;

        const patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: {
            id: true,
            version: true,
            account: {
              select: { id: true },
            },
          },
        });

        if (!patient) {
          throw new NotFoundException('Patient not found.');
        }

        if (patient.account) {
          throw new ConflictException({
            code: 'PATIENT_ACCOUNT_EXISTS',
            message: 'This patient already has a portal account.',
          });
        }

        if (patient.version !== dto.expectedPatientVersion) {
          throw new ConflictException({
            code: 'PATIENT_VERSION_CONFLICT',
            message:
              'Patient details changed. Reload and confirm the patient before creating the account.',
          });
        }

        const account = await tx.patientAccount.create({
          data: {
            patientId,
            email: dto.email,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            createdByStaffId: actorStaffId,
          },
          select: accountFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'PATIENT_ACCOUNT_CREATED_IDENTITY_CONFIRMED',
            resourceType: 'PatientAccount',
            resourceId: account.id,
          },
        });

        return { account };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PATIENT_ACCOUNT_CONFLICT',
          message:
            'The patient or email already has a portal account. Reload the account details.',
        });
      }

      throw error;
    }
  }
}
