import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreatePatientDto } from './dto/create-patient.dto.js';
import type { ListPatientsDto } from './dto/list-patients.dto.js';
import type { UpdatePatientDto } from './dto/update-patient.dto.js';
import { patientContactData } from './patient-contact-data.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

const directoryFields = {
  id: true,
  mrn: true,
  fullName: true,
  phone: true,
  city: true,
  createdAt: true,
  dateOfBirth: true,
  administrativeSex: true,
} satisfies Prisma.PatientSelect;
const detailFields = {
  ...directoryFields,
  addressLine1: true,
  addressLine2: true,
  district: true,
  state: true,
  postalCode: true,
  countryCode: true,
  version: true,
  updatedAt: true,
  phoneOwner: true,
  phoneContactName: true,
  contactEmail: true,

  guardianName: true,
  guardianRelationship: true,
  guardianPhone: true,

  emergencyContactName: true,
  emergencyContactRelationship: true,
  emergencyContactPhone: true,
} satisfies Prisma.PatientSelect;

function parseDateOfBirth(value: string | null): Date | null {
  if (value === null) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Date of birth must use YYYY-MM-DD.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Invalid date of birth.');
  }

  const todayInHospital = new Date(Date.now() + 330 * 60_000)
    .toISOString()
    .slice(0, 10);

  if (value > todayInHospital) {
    throw new BadRequestException('Date of birth cannot be in the future.');
  }

  return date;
}

@Injectable()
export class PatientsService {
  constructor(private readonly database: DatabaseService) {}

  private async findRegistration(
    actorStaffId: string,
    key: string,
    requestHash: string,
  ) {
    const registration =
      await this.database.patientRegistrationRequest.findUnique({
        where: {
          actorStaffId_key: {
            actorStaffId,
            key,
          },
        },
        select: {
          requestHash: true,
          patient: {
            select: directoryFields,
          },
        },
      });

    if (!registration) return null;

    if (registration.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'REGISTRATION_KEY_CONFLICT',
        message:
          'This registration key was already used with different details.',
      });
    }

    return {
      patient: registration.patient,
      replayed: true,
    };
  }

  async create(
    dto: CreatePatientDto,
    actorStaffId: string,
    requestKey: string,
  ) {
    const data = {
      fullName: dto.fullName,
      phone: dto.phone || null,
      addressLine1: dto.addressLine1 || null,
      addressLine2: dto.addressLine2 || null,
      city: dto.city || null,
      district: dto.district || null,
      state: dto.state || null,
      postalCode: dto.postalCode || null,
      countryCode: dto.countryCode || null,
      ...(dto.dateOfBirth !== undefined
        ? {
            dateOfBirth: parseDateOfBirth(dto.dateOfBirth),
          }
        : {}),

      ...(dto.administrativeSex !== undefined
        ? {
            administrativeSex: dto.administrativeSex,
          }
        : {}),
      ...patientContactData(dto),
    };

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          data,
          duplicateReviewConfirmed: dto.duplicateReviewConfirmed === true,
        }),
      )
      .digest('hex');

    const previous = await this.findRegistration(
      actorStaffId,
      requestKey,
      requestHash,
    );

    if (previous) return previous;

    try {
      return await this.database.$transaction(async (tx) => {
        if (dto.duplicateReviewConfirmed !== true) {
          const candidates = await tx.patient.findMany({
            where: {
              OR: [
                {
                  fullName: {
                    equals: data.fullName,
                    mode: 'insensitive',
                  },
                },
                ...(data.phone ? [{ phone: data.phone }] : []),
              ],
            },
            select: directoryFields,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 5,
          });

          if (candidates.length > 0) {
            throw new ConflictException({
              code: 'POSSIBLE_DUPLICATE',
              message:
                'Possible existing patients found. Review them before registering a new patient.',
              candidates,
            });
          }
        }
        const patient = await tx.patient.create({
          data,
          select: directoryFields,
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action:
              dto.duplicateReviewConfirmed === true
                ? 'PATIENT_REGISTERED_AFTER_DUPLICATE_REVIEW'
                : 'PATIENT_REGISTERED',
            resourceType: 'Patient',
            resourceId: patient.id,
          },
        });

        await tx.patientRegistrationRequest.create({
          data: {
            actorStaffId,
            key: requestKey,
            requestHash,
            patientId: patient.id,
          },
        });

        return { patient, replayed: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Another simultaneous request may have committed this key.
        // The failed transaction has rolled back its patient and audit event.
        const previous = await this.findRegistration(
          actorStaffId,
          requestKey,
          requestHash,
        );

        if (previous) return previous;
      }

      throw error;
    }
  }

  async list(query: ListPatientsDto) {
    // Escape PostgreSQL LIKE wildcard characters for literal search.
    const search = query.search?.replace(/[\\%_]/g, '\\$&');

    const where: Prisma.PatientWhereInput = search
      ? {
          OR: [
            {
              mrn: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              phone: {
                contains: search,
              },
            },
          ],
        }
      : {};

    const [items, total] = await this.database.$transaction(
      [
        this.database.patient.findMany({
          where,
          select: directoryFields,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.database.patient.count({ where }),
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

  async findOne(id: string, actorStaffId: string) {
    return this.database.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { id },
        select: detailFields,
      });

      if (!patient) {
        throw new NotFoundException('Patient not found.');
      }

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: 'PATIENT_DEMOGRAPHICS_VIEWED',
          resourceType: 'Patient',
          resourceId: id,
        },
      });

      return { patient };
    });
  }

  async update(id: string, dto: UpdatePatientDto, actorStaffId: string) {
    const { expectedVersion, dateOfBirth, ...otherChanges } = dto;

    const changes = {
      ...otherChanges,
      ...patientContactData(dto),
      ...(dateOfBirth !== undefined
        ? {
            dateOfBirth: parseDateOfBirth(dateOfBirth),
          }
        : {}),
    };

    if (!Object.values(changes).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'Provide at least one demographic field to update.',
      );
    }

    return this.database.$transaction(async (tx) => {
      const existing = await tx.patient.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Patient not found.');
      }

      const updated = await tx.patient.updateMany({
        where: {
          id,
          version: expectedVersion,
        },
        data: {
          ...changes,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'PATIENT_VERSION_CONFLICT',
          message:
            'This patient record changed. Reload it and review your changes before saving again.',
        });
      }

      const patient = await tx.patient.findUniqueOrThrow({
        where: { id },
        select: detailFields,
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: 'PATIENT_DEMOGRAPHICS_UPDATED',
          resourceType: 'Patient',
          resourceId: id,
        },
      });

      return { patient };
    });
  }
}
