import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAuthModule } from '../patient-auth/patient-auth.module.js';
import { PatientAppointmentsController } from './patient-appointments.controller.js';
import { PatientAppointmentsService } from './patient-appointments.service.js';

@Module({
  imports: [DatabaseModule, PatientAuthModule],
  controllers: [PatientAppointmentsController],
  providers: [PatientAppointmentsService],
})
export class PatientPortalModule {}
