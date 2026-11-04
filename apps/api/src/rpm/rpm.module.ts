import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAuthModule } from '../patient-auth/patient-auth.module.js';

import { SimpleRpmController } from './simple-rpm.controller.js';
import { SimpleRpmService } from './simple-rpm.service.js';

import { SimplePatientRpmController } from './simple-patient-rpm.controller.js';

import { SimplePatientRpmService } from './simple-patient-rpm.service.js';

@Module({
  imports: [DatabaseModule, PatientAuthModule],

  controllers: [SimpleRpmController, SimplePatientRpmController],

  providers: [SimpleRpmService, SimplePatientRpmService],
})
export class RpmModule {}
