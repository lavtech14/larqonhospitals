import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAccessGuard } from './patient-access.guard.js';
import { PatientAuthController } from './patient-auth.controller.js';
import { PatientAuthService } from './patient-auth.service.js';
import { PatientTokenService } from './patient-token.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PatientAuthController],
  providers: [PatientAuthService, PatientTokenService, PatientAccessGuard],
  exports: [PatientAccessGuard, PatientTokenService],
})
export class PatientAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        rateLimit({
          windowMs: 15 * 60_000,
          limit: 10,
          standardHeaders: true,
          legacyHeaders: false,
          skipSuccessfulRequests: true,
          message: {
            message: 'Too many failed attempts. Try again later.',
          },
        }),
      )
      .forRoutes(
        {
          path: 'patient/auth/login',
          method: RequestMethod.POST,
        },
        {
          path: 'patient/auth/change-password',
          method: RequestMethod.POST,
        },
      );
  }
}
