import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../auth/auth.decorators.js';

import { PatientAccessGuard } from '../patient-auth/patient-access.guard.js';

import { CurrentPatient } from '../patient-auth/patient-auth.decorators.js';

import type { PatientIdentity } from '../patient-auth/patient-auth.decorators.js';

import { PatientVisitsPageDto } from './patient-visits.dto.js';
import { PatientVisitsService } from './patient-visits.service.js';

@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/visits')
export class PatientVisitsController {
  constructor(private readonly visits: PatientVisitsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentPatient() identity: PatientIdentity,
    @Query() query: PatientVisitsPageDto,
  ) {
    return this.visits.list(identity.user.id, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.visits.detail(identity.user.id, id);
  }

  @Get(':id/vitals')
  @Header('Cache-Control', 'no-store')
  vitals(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PatientVisitsPageDto,
  ) {
    return this.visits.vitals(identity.user.id, id, query);
  }

  @Get(':id/summary')
  @Header('Cache-Control', 'no-store')
  summary(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.visits.summary(identity.user.id, id);
  }

  @Get(':id/prescriptions')
  @Header('Cache-Control', 'no-store')
  prescriptions(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PatientVisitsPageDto,
  ) {
    return this.visits.prescriptions(identity.user.id, id, query);
  }

  @Get(':id/prescriptions/:prescriptionId')
  @Header('Cache-Control', 'no-store')
  prescription(
    @CurrentPatient() identity: PatientIdentity,

    @Param('id', ParseUUIDPipe)
    id: string,

    @Param('prescriptionId', ParseUUIDPipe)
    prescriptionId: string,
  ) {
    return this.visits.prescription(identity.user.id, id, prescriptionId);
  }
}
