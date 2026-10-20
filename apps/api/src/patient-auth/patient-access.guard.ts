import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DatabaseService } from '../database/database.service.js';
import { PatientTokenService } from './patient-token.service.js';
import {
  PATIENT_ALLOW_PENDING,
  PATIENT_PUBLIC,
} from './patient-auth.decorators.js';
import type { PatientRequest } from './patient-auth.decorators.js';

@Injectable()
export class PatientAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly tokens: PatientTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(PATIENT_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PatientRequest>();

    const cookies = request.cookies as Record<string, unknown> | undefined;

    const token = cookies?.larqon_patient_access;

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Patient login required.');
    }

    const identity = await this.tokens.verify(token);

    const session = await this.database.patientSession.findFirst({
      where: {
        id: identity.sessionId,
        patientAccountId: identity.accountId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        account: {
          select: {
            id: true,
            patientId: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            patient: {
              select: {
                fullName: true,
                mrn: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.account.isActive) {
      throw new UnauthorizedException('Patient session is no longer valid.');
    }

    const account = session.account;

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      PATIENT_ALLOW_PENDING,
      targets,
    );

    if (account.mustChangePassword && !allowPending) {
      throw new ForbiddenException({
        code: 'PATIENT_PASSWORD_CHANGE_REQUIRED',
        message: 'Change your temporary password before continuing.',
      });
    }

    request.patientIdentity = {
      sessionId: session.id,
      user: {
        id: account.id,
        patientId: account.patientId,
        email: account.email,
        fullName: account.patient.fullName,
        mrn: account.patient.mrn,
        mustChangePassword: account.mustChangePassword,
      },
    };

    return true;
  }
}
