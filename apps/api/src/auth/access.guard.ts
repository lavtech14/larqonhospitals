import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service.js';
import { TokenService } from './token.service.js';
import {
  ALLOW_PASSWORD_CHANGE_PENDING,
  PUBLIC_ROUTE,
} from './auth.decorators.js';
import type { StaffRequest } from './auth.decorators.js';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const cookies = request.cookies as Record<string, unknown> | undefined;

    const token = cookies?.larqon_access;

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Login required.');
    }

    const identity = await this.tokens.verifyAccessToken(token);

    const session = await this.database.staffSession.findFirst({
      where: {
        id: identity.sessionId,
        staffUserId: identity.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
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

    if (!session || !session.staffUser.isActive) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const user = session.staffUser;

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_PENDING,
      targets,
    );

    if (user.mustChangePassword && !allowPending) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your initial password before continuing.',
      });
    }

    request.staffIdentity = {
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((assignment) => assignment.role),
        mustChangePassword: user.mustChangePassword,
      },
    };

    return true;
  }
}
