import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { TokenService } from './token.service.js';
import { createRefreshToken, hashRefreshToken } from './refresh-token.js';

@Injectable()
export class RefreshService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tokens: TokenService,
  ) {}

  async refresh(rawToken: unknown) {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/.test(rawToken)) {
      throw new UnauthorizedException('Refresh session is invalid.');
    }

    const stored = await this.database.staffRefreshToken.findUnique({
      where: {
        tokenHash: hashRefreshToken(rawToken),
      },
      select: {
        id: true,
        sessionId: true,
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh session is invalid.');
    }

    const result = await this.database.$transaction(async (tx) => {
      // Serialize refresh operations for this session.
      // Tagged-template parameters are bound safely by Prisma.
      await tx.$queryRaw`
        SELECT "id"
        FROM "StaffSession"
        WHERE "id" = ${stored.sessionId}::uuid
        FOR UPDATE
      `;

      const now = new Date();

      const session = await tx.staffSession.findUnique({
        where: { id: stored.sessionId },
        select: {
          id: true,
          expiresAt: true,
          revokedAt: true,
          staffUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
              isActive: true,
              mustChangePassword: true,
              roles: {
                select: { role: true },
              },
            },
          },
        },
      });

      if (!session || session.revokedAt || session.expiresAt <= now) {
        return null;
      }

      if (!session.staffUser.isActive) {
        await tx.staffSession.update({
          where: { id: session.id },
          data: { revokedAt: now },
        });

        return null;
      }

      const token = await tx.staffRefreshToken.findUnique({
        where: { id: stored.id },
        select: {
          id: true,
          usedAt: true,
          expiresAt: true,
        },
      });

      if (!token) {
        return null;
      }

      if (token.usedAt) {
        // Commit revocation before returning the authentication error.
        await tx.staffSession.update({
          where: { id: session.id },
          data: { revokedAt: now },
        });

        return null;
      }

      if (token.expiresAt <= now) {
        return null;
      }

      await tx.staffRefreshToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });

      const refreshToken = createRefreshToken();

      await tx.staffRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: session.expiresAt,
        },
      });

      const user = session.staffUser;

      const accessToken = await this.tokens.createAccessToken({
        userId: user.id,
        sessionId: session.id,
      });

      return {
        accessToken,
        refreshToken,
        sessionExpiresAt: session.expiresAt,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles.map((assignment) => assignment.role),
          mustChangePassword: user.mustChangePassword,
        },
      };
    });

    if (!result) {
      throw new UnauthorizedException(
        'Refresh session expired or was revoked. Log in again.',
      );
    }

    return result;
  }
}
