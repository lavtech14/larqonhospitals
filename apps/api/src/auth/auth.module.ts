import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
