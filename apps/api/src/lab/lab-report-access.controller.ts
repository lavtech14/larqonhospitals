import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentStaff, Public } from '../auth/auth.decorators.js';

import { RequirePermissions } from '../auth/permissions.js';

import { PatientAccessGuard } from '../patient-auth/patient-access.guard.js';

import { CurrentPatient } from '../patient-auth/patient-auth.decorators.js';

import type { PatientIdentity } from '../patient-auth/patient-auth.decorators.js';

import { LabResultsPageDto } from './lab-results.dto.js';
import { LabReportAccessService } from './lab-report-access.service.js';

@Controller('doctor/appointments/:appointmentId/lab-reports')
export class DoctorLabReportsController {
  constructor(private readonly reports: LabReportAccessService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab-orders.own.read')
  list(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Query()
    query: LabResultsPageDto,
  ) {
    return this.reports.doctorList(appointmentId, staff.user.id, query);
  }

  @Get(':reportId')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab-orders.own.read')
  report(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,

    @Param('reportId', ParseUUIDPipe)
    reportId: string,

    @CurrentStaff()
    staff: { user: { id: string } },
  ) {
    return this.reports.doctorReport(appointmentId, reportId, staff.user.id);
  }
}

@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/visits/:visitId/lab-reports')
export class PatientLabReportsController {
  constructor(private readonly reports: LabReportAccessService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('visitId', ParseUUIDPipe)
    visitId: string,

    @CurrentPatient()
    identity: PatientIdentity,

    @Query()
    query: LabResultsPageDto,
  ) {
    return this.reports.patientList(visitId, identity.user.id, query);
  }

  @Get(':reportId')
  @Header('Cache-Control', 'no-store')
  report(
    @Param('visitId', ParseUUIDPipe)
    visitId: string,

    @Param('reportId', ParseUUIDPipe)
    reportId: string,

    @CurrentPatient()
    identity: PatientIdentity,
  ) {
    return this.reports.patientReport(visitId, reportId, identity.user.id);
  }
}
