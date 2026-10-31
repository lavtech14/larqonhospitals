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

import { CreateVitalsDto } from './create-vitals.dto.js';
import { ListVitalsDto } from './list-vitals.dto.js';
import { VitalsService } from './vitals.service.js';

@Controller('encounters')
export class VitalsController {
  constructor(private readonly vitals: VitalsService) {}

  @Post(':id/vitals')
  @HttpCode(200)
  @RequirePermissions('encounters.vitals.record', 'nursing.queue.read')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVitalsDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A valid UUID Idempotency-Key header is required.',
      );
    }

    return this.vitals.create(id, dto, staff.user.id, key);
  }

  @Get(':id/vitals')
  @RequirePermissions('encounters.vitals.read', 'nursing.queue.read')
  list(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListVitalsDto) {
    return this.vitals.list(id, query);
  }
}
