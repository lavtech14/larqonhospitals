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
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { ChangePasswordDto } from './change-password.dto.js';
import {
  AllowPasswordChangePending,
  CurrentStaff,
  Public,
} from './auth.decorators.js';
import type { CurrentStaffIdentity } from './auth.decorators.js';

function accessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  };
}

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

    response.cookie('larqon_access', result.accessToken, {
      ...accessCookieOptions(),
      maxAge: 15 * 60 * 1000,
    });

    return { user: result.user };
  }

  @AllowPasswordChangePending()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentStaff() identity: CurrentStaffIdentity) {
    return { user: identity.user };
  }

  @AllowPasswordChangePending()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async logout(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(identity.user.id, identity.sessionId);

    response.clearCookie('larqon_access', accessCookieOptions());

    return { message: 'Logged out successfully.' };
  }

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

    response.clearCookie('larqon_access', accessCookieOptions());

    return {
      message: 'Password changed. Log in again with your new password.',
    };
  }
}
