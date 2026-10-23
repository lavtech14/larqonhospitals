import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../auth/auth.decorators.js';
import { PatientAccessGuard } from '../patient-auth/patient-access.guard.js';
import { CurrentPatient } from '../patient-auth/patient-auth.decorators.js';
import type { PatientIdentity } from '../patient-auth/patient-auth.decorators.js';
import { ConsultationsService } from './consultations.service.js';

@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/appointments')
export class PatientConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Post(':id/consultation/join')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  join(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.consultations.joinAsPatient(identity.user.id, id);
  }

  @Get(':id/consultation')
  @Header('Cache-Control', 'no-store')
  status(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.consultations.statusAsPatient(identity.user.id, id);
  }
}
