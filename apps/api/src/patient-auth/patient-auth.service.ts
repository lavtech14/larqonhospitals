import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { PatientTokenService } from './patient-token.service.js';
import { createRefreshToken, hashRefreshToken } from '../auth/refresh-token.js';

@Injectable()
export class PatientAuthService implements OnModuleInit {
  private dummyPasswordHash!: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly tokens: PatientTokenService,
  ) {}

  async onModuleInit() {
    this.dummyPasswordHash = await hashPassword(randomUUID());
  }
  async refresh(refreshTokenInput: unknown) {
    if (
      typeof refreshTokenInput !== 'string' ||
      refreshTokenInput.length < 32 ||
      refreshTokenInput.length > 512
    ) {
      throw new UnauthorizedException('Patient login required.');
    }

    const tokenHash = hashRefreshToken(refreshTokenInput);

    const known = await this.database.patientRefreshToken.findUnique({
      where: { tokenHash },
      select: {
        sessionId: true,
        session: {
          select: {
            patientAccountId: true,
          },
        },
      },
    });

    if (!known) {
      throw new UnauthorizedException('Invalid patient refresh token.');
    }

    const result = await this.database.$transaction(
      async (tx) => {
        // Same account-first lock order as login/password change.
        await tx.$queryRaw`
          SELECT "id"
          FROM "PatientAccount"
          WHERE "id" = ${known.session.patientAccountId}::uuid
          FOR UPDATE
        `;

        await tx.$queryRaw`
          SELECT "id"
          FROM "PatientSession"
          WHERE "id" = ${known.sessionId}::uuid
          FOR UPDATE
        `;

        const token = await tx.patientRefreshToken.findUnique({
          where: { tokenHash },
          select: {
            id: true,
            usedAt: true,
            expiresAt: true,
            session: {
              select: {
                id: true,
                expiresAt: true,
                revokedAt: true,
                account: {
                  select: {
                    id: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });

        if (!token) return null;

        const now = new Date();
        const session = token.session;

        if (token.usedAt) {
          // Commit revocation before returning an unauthorized response.
          await tx.patientSession.updateMany({
            where: {
              id: session.id,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });

          return null;
        }

        if (
          session.revokedAt ||
          !session.account.isActive ||
          session.expiresAt.getTime() <= now.getTime() ||
          token.expiresAt.getTime() <= now.getTime()
        ) {
          return null;
        }

        await tx.patientRefreshToken.update({
          where: { id: token.id },
          data: { usedAt: now },
        });

        const refreshToken = createRefreshToken();

        await tx.patientRefreshToken.create({
          data: {
            sessionId: session.id,
            tokenHash: hashRefreshToken(refreshToken),
            // Renewal does not extend the original session deadline.
            expiresAt: session.expiresAt,
          },
        });

        const accessToken = await this.tokens.create({
          accountId: session.account.id,
          sessionId: session.id,
        });

        return {
          accessToken,
          refreshToken,
          sessionExpiresAt: session.expiresAt,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 10_000,
      },
    );

    if (!result) {
      throw new UnauthorizedException(
        'Patient session expired or was revoked. Sign in again.',
      );
    }

    return result;
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();

    const account = await this.database.patientAccount.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
      },
    });

    const matches = await verifyPassword(
      account?.passwordHash ?? this.dummyPasswordHash,
      password,
    );

    if (!account?.isActive || !matches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "PatientAccount"
        WHERE "id" = ${account.id}::uuid
        FOR UPDATE
      `;

      const current = await tx.patientAccount.findUnique({
        where: { id: account.id },
        select: {
          id: true,
          patientId: true,
          email: true,
          passwordHash: true,
          isActive: true,
          mustChangePassword: true,
          patient: {
            select: {
              fullName: true,
              mrn: true,
            },
          },
        },
      });

      if (!current?.isActive || current.passwordHash !== account.passwordHash) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);

      const refreshToken = createRefreshToken();

      const session = await tx.patientSession.create({
        data: {
          patientAccountId: current.id,
          expiresAt: sessionExpiresAt,
          refreshTokens: {
            create: {
              tokenHash: hashRefreshToken(refreshToken),
              expiresAt: sessionExpiresAt,
            },
          },
        },
        select: { id: true },
      });

      const accessToken = await this.tokens.create({
        accountId: current.id,
        sessionId: session.id,
      });

      return {
        accessToken,
        refreshToken,
        sessionExpiresAt,
        user: {
          id: current.id,
          patientId: current.patientId,
          email: current.email,
          fullName: current.patient.fullName,
          mrn: current.patient.mrn,
          mustChangePassword: current.mustChangePassword,
        },
      };
    });
  }

  async logout(accountId: string, sessionId: string) {
    await this.database.patientSession.updateMany({
      where: {
        id: sessionId,
        patientAccountId: accountId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async changePassword(
    accountId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const account = await this.database.patientAccount.findUnique({
      where: { id: accountId },
      select: {
        passwordHash: true,
        isActive: true,
      },
    });

    if (
      !account?.isActive ||
      !(await verifyPassword(account.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'Choose a password different from your current password.',
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await this.database.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "PatientAccount"
        WHERE "id" = ${accountId}::uuid
        FOR UPDATE
      `;

      const session = await tx.patientSession.findFirst({
        where: {
          id: sessionId,
          patientAccountId: accountId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!session) {
        throw new UnauthorizedException('Patient session is no longer valid.');
      }

      const updated = await tx.patientAccount.updateMany({
        where: {
          id: accountId,
          isActive: true,
          passwordHash: account.passwordHash,
        },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new UnauthorizedException(
          'Account credentials changed. Sign in again.',
        );
      }

      await tx.patientSession.updateMany({
        where: {
          patientAccountId: accountId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });
  }
}
