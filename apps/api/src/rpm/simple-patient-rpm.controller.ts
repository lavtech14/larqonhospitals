import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { isUUID } from 'class-validator';

import { Public } from '../auth/auth.decorators.js';

import { PatientAccessGuard } from '../patient-auth/patient-access.guard.js';
import { CurrentPatient } from '../patient-auth/patient-auth.decorators.js';

import type { PatientIdentity } from '../patient-auth/patient-auth.decorators.js';

import { ListSimpleRpmDto, SubmitRpmReadingDto } from './simple-rpm.dto.js';

import { SimplePatientRpmService } from './simple-patient-rpm.service.js';

@Public()
@UseGuards(PatientAccessGuard)
@Controller('patient/rpm')
export class SimplePatientRpmController {
  constructor(private readonly rpm: SimplePatientRpmService) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@CurrentPatient() identity: PatientIdentity) {
    return this.rpm.summary(identity.user.id);
  }

  @Get('assignments')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentPatient() identity: PatientIdentity,
    @Query() query: ListSimpleRpmDto,
  ) {
    return this.rpm.list(identity.user.id, query);
  }

  @Post('assignments/:id/readings')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  submit(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: unknown,
    @Body() dto: SubmitRpmReadingDto,
  ) {
    if (typeof key !== 'string' || !isUUID(key, '4')) {
      throw new BadRequestException(
        'Provide a UUID v4 Idempotency-Key header.',
      );
    }

    return this.rpm.submit(identity.user.id, id, key, dto);
  }

  @Get('assignments/:id/readings')
  @Header('Cache-Control', 'no-store')
  history(
    @CurrentPatient() identity: PatientIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSimpleRpmDto,
  ) {
    return this.rpm.history(identity.user.id, id, query);
  }
}
