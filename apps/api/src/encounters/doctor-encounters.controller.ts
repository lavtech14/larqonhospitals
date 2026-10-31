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
  Query,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import {
  DoctorEncounterQueryDto,
  EncounterVersionDto,
  SaveClinicalNotesDto,
} from './doctor-encounter.dto.js';

import { DoctorEncountersService } from './doctor-encounters.service.js';

@Controller('doctor/appointments')
export class DoctorEncountersController {
  constructor(private readonly encounters: DoctorEncountersService) {}

  @Get(':id/encounter')
  @RequirePermissions('encounters.own.read')
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DoctorEncounterQueryDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.encounters.read(id, staff.user.id, query);
  }

  @Post(':id/encounter/start')
  @HttpCode(200)
  @RequirePermissions('encounters.own.read', 'encounters.own.start')
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EncounterVersionDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.encounters.start(id, staff.user.id, dto);
  }

  @Post(':id/encounter/notes')
  @HttpCode(200)
  @RequirePermissions('encounters.own.read', 'encounters.own.notes.write')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveClinicalNotesDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.encounters.save(id, staff.user.id, key, dto);
  }
}
