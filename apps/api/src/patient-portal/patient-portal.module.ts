import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAuthModule } from '../patient-auth/patient-auth.module.js';

import { PatientAppointmentsController } from './patient-appointments.controller.js';
import { PatientAppointmentsService } from './patient-appointments.service.js';

import { PatientVisitsController } from './patient-visits.controller.js';
import { PatientVisitsService } from './patient-visits.service.js';

@Module({
  imports: [DatabaseModule, PatientAuthModule],

  controllers: [PatientAppointmentsController, PatientVisitsController],

  providers: [PatientAppointmentsService, PatientVisitsService],
})
export class PatientPortalModule {}
