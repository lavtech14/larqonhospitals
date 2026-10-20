import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

import { Public } from '../auth/auth.decorators.js';
import { LoginDto } from '../auth/login.dto.js';
import { ChangePasswordDto } from '../auth/change-password.dto.js';

import { PatientAccessGuard } from './patient-access.guard.js';
import { PatientAuthService } from './patient-auth.service.js';
import {
  clearPatientAuthCookies,
  setPatientAuthCookies,
} from './patient-auth.cookies.js';

import {
  AllowPatientPasswordChangePending,
  CurrentPatient,
  PatientPublic,
} from './patient-auth.decorators.js';
import type { PatientIdentity } from './patient-auth.decorators.js';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/patient',
  };
}

/*
 * Public skips the global STAFF guard.
 * PatientAccessGuard independently protects this controller.
 */
@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/auth')
export class PatientAuthController {
  constructor(private readonly auth: PatientAuthService) {}

  @PatientPublic()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body.email, body.password);

    setPatientAuthCookies(response, result);

    return { user: result.user };
  }

  @AllowPatientPasswordChangePending()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentPatient() identity: PatientIdentity) {
    return { user: identity.user };
  }

  @AllowPatientPasswordChangePending()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @CurrentPatient() identity: PatientIdentity,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(
      identity.user.id,
      identity.sessionId,
      body.currentPassword,
      body.newPassword,
    );

    clearPatientAuthCookies(response);

    return {
      message: 'Password changed. Sign in with your new password.',
    };
  }

  @AllowPatientPasswordChangePending()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async logout(
    @CurrentPatient() identity: PatientIdentity,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(identity.user.id, identity.sessionId);

    clearPatientAuthCookies(response);

    return { message: 'Logged out successfully.' };
  }

  @PatientPublic()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, unknown> | undefined;

    try {
      const result = await this.auth.refresh(cookies?.larqon_patient_refresh);

      setPatientAuthCookies(response, result);

      return { message: 'Patient session renewed.' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        clearPatientAuthCookies(response);
      }

      throw error;
    }
  }
}
