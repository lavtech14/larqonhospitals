import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const PATIENT_PUBLIC = 'patient-auth:public';
export const PATIENT_ALLOW_PENDING =
  'patient-auth:allow-password-change-pending';

export interface PatientIdentity {
  sessionId: string;
  user: {
    id: string;
    patientId: string;
    email: string;
    fullName: string;
    mrn: string;
    mustChangePassword: boolean;
  };
}

export interface PatientRequest extends Request {
  patientIdentity?: PatientIdentity;
}

export const PatientPublic = () => SetMetadata(PATIENT_PUBLIC, true);

export const AllowPatientPasswordChangePending = () =>
  SetMetadata(PATIENT_ALLOW_PENDING, true);

export const CurrentPatient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PatientIdentity => {
    const request = context.switchToHttp().getRequest<PatientRequest>();

    if (!request.patientIdentity) {
      throw new UnauthorizedException('Patient login required.');
    }

    return request.patientIdentity;
  },
);
