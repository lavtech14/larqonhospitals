import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { Public } from '../auth/auth.decorators.js';
import { PatientAccessGuard } from '../patient-auth/patient-access.guard.js';
import { CurrentPatient } from '../patient-auth/patient-auth.decorators.js';
import type { PatientIdentity } from '../patient-auth/patient-auth.decorators.js';
import { ListOwnAppointmentsDto } from '../appointments/list-own-appointments.dto.js';
import { PatientAppointmentsService } from './patient-appointments.service.js';

@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/appointments')
export class PatientAppointmentsController {
  constructor(private readonly appointments: PatientAppointmentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentPatient() identity: PatientIdentity,
    @Query() query: ListOwnAppointmentsDto,
  ) {
    return this.appointments.list(identity.user.id, query);
  }
}
