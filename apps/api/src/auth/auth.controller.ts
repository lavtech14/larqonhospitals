import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { clearAuthCookies, setAuthCookies } from './auth.cookies.js';

import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { ChangePasswordDto } from './change-password.dto.js';
import {
  AllowPasswordChangePending,
  CurrentStaff,
  Public,
} from './auth.decorators.js';
import type { CurrentStaffIdentity } from './auth.decorators.js';
import { AuthenticatedOnly, permissionsForRoles } from './permissions.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body.email, body.password);

    setAuthCookies(response, result);

    return { user: result.user };
  }
  @AuthenticatedOnly()
  @AllowPasswordChangePending()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentStaff() identity: CurrentStaffIdentity) {
    return {
      user: {
        ...identity.user,
        permissions: permissionsForRoles(identity.user.roles),
      },
    };
  }

  @AuthenticatedOnly()
  @AllowPasswordChangePending()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async logout(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(identity.user.id, identity.sessionId);

    clearAuthCookies(response);

    return { message: 'Logged out successfully.' };
  }

  @AuthenticatedOnly()
  @AllowPasswordChangePending()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(
      identity.user.id,
      identity.sessionId,
      body.currentPassword,
      body.newPassword,
    );

    clearAuthCookies(response);

    return {
      message: 'Password changed. Log in again with your new password.',
    };
  }
}
