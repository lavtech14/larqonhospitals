import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { RequirePermissions } from '../auth/permissions.js';
import { CurrentStaff } from '../auth/auth.decorators.js';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './create-appointment.dto.js';
import { ListAppointmentsDto } from './list-appointments.dto.js';
import { CancelAppointmentDto } from './cancel-appointment.dto.js';
import { ListOwnAppointmentsDto } from './list-own-appointments.dto.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @RequirePermissions(
    'appointments.create',
    'patients.demographics.read',
    'availability.read',
  )
  create(
    @Body() dto: CreateAppointmentDto,
    @Headers('idempotency-key')
    idempotencyKey: string | undefined,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    if (typeof idempotencyKey !== 'string' || !isUUID(idempotencyKey)) {
      throw new BadRequestException(
        'A valid UUID Idempotency-Key header is required.',
      );
    }

    return this.appointmentsService.create(dto, staff.user.id, idempotencyKey);
  }

  @Get()
  @RequirePermissions('appointments.read', 'patients.demographics.read')
  list(@Query() query: ListAppointmentsDto) {
    return this.appointmentsService.list(query);
  }

  @Patch(':id/cancel')
  @RequirePermissions('appointments.read', 'appointments.cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.appointmentsService.cancel(id, dto, staff.user.id);
  }

  @Get('mine')
  @RequirePermissions('appointments.own.read')
  listOwn(
    @Query() query: ListOwnAppointmentsDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.appointmentsService.listOwn(staff.user.id, query);
  }
}
