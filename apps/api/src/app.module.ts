import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { StaffModule } from './staff/staff.module.js';
import { PatientAccountsModule } from './patient-accounts/patient-accounts.module.js';
import { PatientAuthModule } from './patient-auth/patient-auth.module.js';
import { PatientPortalModule } from './patient-portal/patient-portal.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PatientsModule,
    DepartmentsModule,
    DoctorsModule,
    AvailabilityModule,
    AppointmentsModule,
    StaffModule,
    PatientAccountsModule,
    PatientAuthModule,
    PatientPortalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
