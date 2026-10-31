import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import {
  CreatePrescriptionDto,
  ListPrescriptionsDto,
  SavePrescriptionDto,
  IssuePrescriptionDto,
  DiscardPrescriptionDto,
} from './prescription.dto.js';

import { PrescriptionsService } from './prescriptions.service.js';

function requestKey(key: string | undefined): string {
  if (typeof key !== 'string' || !isUUID(key)) {
    throw new BadRequestException('A UUID Idempotency-Key header is required.');
  }

  return key;
}

@Controller('doctor/appointments/:appointmentId/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @RequirePermissions('prescriptions.own.read')
  list(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,
    @Query() query: ListPrescriptionsDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.prescriptions.list(appointmentId, staff.user.id, query);
  }

  @Get(':id')
  @RequirePermissions('prescriptions.own.read')
  get(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.prescriptions.get(appointmentId, id, staff.user.id);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('prescriptions.own.read', 'prescriptions.own.write')
  create(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,
    @Body() dto: CreatePrescriptionDto,
    @Headers('idempotency-key')
    key: string | undefined,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.prescriptions.create(
      appointmentId,
      staff.user.id,
      requestKey(key),
      dto,
    );
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermissions('prescriptions.own.read', 'prescriptions.own.write')
  save(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SavePrescriptionDto,
    @Headers('idempotency-key')
    key: string | undefined,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.prescriptions.save(
      appointmentId,
      id,
      staff.user.id,
      requestKey(key),
      dto,
    );
  }

  @Post(':id/issue')
  @HttpCode(200)
  @RequirePermissions('prescriptions.own.read', 'prescriptions.own.issue')
  issue(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: IssuePrescriptionDto,
    @Headers('idempotency-key')
    key: string | undefined,
    @CurrentStaff()
    staff: { user: { id: string } },
  ) {
    return this.prescriptions.issue(
      appointmentId,
      id,
      staff.user.id,
      requestKey(key),
      dto,
    );
  }

  @Post(':id/discard')
  @HttpCode(200)
  @RequirePermissions('prescriptions.own.read', 'prescriptions.own.write')
  discard(
    @Param('appointmentId', ParseUUIDPipe)
    appointmentId: string,

    @Param('id', ParseUUIDPipe)
    id: string,

    @Body()
    dto: DiscardPrescriptionDto,

    @Headers('idempotency-key')
    key: string | undefined,

    @CurrentStaff()
    staff: { user: { id: string } },
  ) {
    return this.prescriptions.discard(
      appointmentId,
      id,
      staff.user.id,
      requestKey(key),
      dto,
    );
  }
}
