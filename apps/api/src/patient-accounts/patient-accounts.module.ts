import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAccountsController } from './patient-accounts.controller.js';
import { PatientAccountsService } from './patient-accounts.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PatientAccountsController],
  providers: [PatientAccountsService],
})
export class PatientAccountsModule {}
