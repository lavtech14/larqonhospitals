import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAuthModule } from '../patient-auth/patient-auth.module.js';

import {
  DoctorLabReportsController,
  PatientLabReportsController,
} from './lab-report-access.controller.js';

import { LabReportAccessService } from './lab-report-access.service.js';

@Module({
  imports: [DatabaseModule, PatientAuthModule],

  controllers: [DoctorLabReportsController, PatientLabReportsController],

  providers: [LabReportAccessService],
})
export class LabReportAccessModule {}
