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
} from '@nestjs/common';

import { isUUID } from 'class-validator';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import { CreateRpmAssignmentDto, ListSimpleRpmDto } from './simple-rpm.dto.js';

import { SimpleRpmService } from './simple-rpm.service.js';

@Controller('rpm')
export class SimpleRpmController {
  constructor(private readonly rpm: SimpleRpmService) {}

  @Get('patient-lookup')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.assign')
  lookupPatient(
    @Query() query: ListSimpleRpmDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    const mrn = query.search?.trim();

    if (!mrn) {
      throw new BadRequestException('Enter the patient MRN.');
    }

    return this.rpm.lookupPatient(staff.user.id, mrn);
  }

  @Get('nurses')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.assign')
  nurses(
    @Query() query: ListSimpleRpmDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.rpm.nurses(staff.user.id, query);
  }

  @Post('assignments')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.assign')
  assign(
    @Body() dto: CreateRpmAssignmentDto,
    @Headers('idempotency-key') key: unknown,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    if (typeof key !== 'string' || !isUUID(key, '4')) {
      throw new BadRequestException(
        'Provide a UUID v4 Idempotency-Key header.',
      );
    }

    return this.rpm.assign(staff.user.id, key, dto);
  }

  @Get('assignments')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.read')
  list(
    @Query() query: ListSimpleRpmDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.rpm.list(staff.user.id, query);
  }

  @Get('assignments/:id')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.read')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.rpm.detail(staff.user.id, id);
  }

  @Get('assignments/:id/readings')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('rpm.read')
  readings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSimpleRpmDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.rpm.readings(staff.user.id, id, query);
  }
}
