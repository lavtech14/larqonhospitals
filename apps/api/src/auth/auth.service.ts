import type { OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { TokenService } from './token.service.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createRefreshToken, hashRefreshToken } from './refresh-token.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash!: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly tokens: TokenService,
  ) {}

  async onModuleInit() {
    this.dummyPasswordHash = await hashPassword(randomUUID());
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();

    const user = await this.database.staffUser.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
      },
    });

    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? this.dummyPasswordHash,
      password,
    );

    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.database.$transaction(async (tx) => {
      const current = await tx.staffUser.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          passwordHash: true,
          isActive: true,
          mustChangePassword: true,
          roles: {
            select: { role: true },
          },
        },
      });

      if (
        !current ||
        !current.isActive ||
        current.passwordHash !== user.passwordHash
      ) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const refreshToken = createRefreshToken();

      const session = await tx.staffSession.create({
        data: {
          staffUserId: current.id,
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

      const accessToken = await this.tokens.createAccessToken({
        userId: current.id,
        sessionId: session.id,
      });

      return {
        accessToken,
        refreshToken,
        sessionExpiresAt,
        user: {
          id: current.id,
          email: current.email,
          fullName: current.fullName,
          roles: current.roles.map((assignment) => assignment.role),
          mustChangePassword: current.mustChangePassword,
        },
      };
    });
  }
  async logout(userId: string, sessionId: string) {
    await this.database.staffSession.updateMany({
      where: {
        id: sessionId,
        staffUserId: userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.database.staffUser.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        isActive: true,
      },
    });

    if (
      !user?.isActive ||
      !(await verifyPassword(user.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'Choose a password different from your current password.',
      );
    }

    const newHash = await hashPassword(newPassword);

    await this.database.$transaction(async (tx) => {
      const session = await tx.staffSession.findFirst({
        where: {
          id: sessionId,
          staffUserId: userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!session) {
        throw new UnauthorizedException('Session is no longer valid.');
      }

      const updated = await tx.staffUser.updateMany({
        where: {
          id: userId,
          isActive: true,
          passwordHash: user.passwordHash,
        },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new UnauthorizedException(
          'Account credentials changed. Log in again.',
        );
      }

      await tx.staffSession.updateMany({
        where: {
          staffUserId: userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });
  }
}
