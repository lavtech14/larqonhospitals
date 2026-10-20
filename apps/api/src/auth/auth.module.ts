import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { RefreshController } from './refresh.controller.js';
import { RefreshService } from './refresh.service.js';
import { AccessCheckController } from './access-check.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, RefreshController, AccessCheckController],
  providers: [
    AuthService,
    TokenService,
    RefreshService,
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
