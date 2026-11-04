import { BillingModule } from './billing/billing.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
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
import { HealthController } from './health.controller.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { EncountersModule } from './encounters/encounters.module.js';
import { MedicinesModule } from './medicines/medicines.module.js';
import { PrescriptionsModule } from './prescriptions/prescriptions.module.js';
import { LabTestsModule } from './lab-tests/lab-tests.module.js';
import { LabOrdersModule } from './lab-orders/lab-orders.module.js';
import { LabModule } from './lab/lab.module.js';
import { LabReportAccessModule } from './lab/lab-report-access.module.js';
import { RpmModule } from './rpm/rpm.module.js';

@Module({
  imports: [
    BillingModule,
    PharmacyModule,
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
    ConsultationsModule,
    EncountersModule,
    MedicinesModule,
    PrescriptionsModule,
    LabTestsModule,
    LabOrdersModule,
    LabModule,
    LabReportAccessModule,
    RpmModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
