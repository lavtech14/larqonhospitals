import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const PUBLIC_ROUTE = 'auth:public';
export const ALLOW_PASSWORD_CHANGE_PENDING = 'auth:allowPasswordChangePending';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const AllowPasswordChangePending = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true);

export type CurrentStaffIdentity = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    mustChangePassword: boolean;
  };
};

export type StaffRequest = Request & {
  staffIdentity?: CurrentStaffIdentity;
};

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentStaffIdentity => {
    const request = context.switchToHttp().getRequest<StaffRequest>();

    if (!request.staffIdentity) {
      throw new UnauthorizedException();
    }

    return request.staffIdentity;
  },
);
