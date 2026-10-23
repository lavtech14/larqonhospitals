import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PatientAuthModule } from '../patient-auth/patient-auth.module.js';
import { ConsultationsService } from './consultations.service.js';
import { DoctorConsultationsController } from './doctor-consultations.controller.js';
import { PatientConsultationsController } from './patient-consultations.controller.js';

@Module({
  imports: [DatabaseModule, PatientAuthModule],
  controllers: [DoctorConsultationsController, PatientConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
