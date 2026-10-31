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

import {
  LabResultsPageDto,
  LabResultsQueueDto,
  SaveLabResultDto,
} from './lab-results.dto.js';

import { LabResultsService } from './lab-results.service.js';

@Controller('lab')
export class LabResultsController {
  constructor(private readonly results: LabResultsService) {}

  @Get('results/queue')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab.results.read')
  queue(@Query() query: LabResultsQueueDto) {
    return this.results.queue(query);
  }

  @Get('samples/:id/result')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab.results.read')
  read(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Query()
    query: LabResultsPageDto,
  ) {
    return this.results.read(id, query);
  }

  @Post('samples/:id/result')
  @HttpCode(200)
  @RequirePermissions('lab.results.read', 'lab.results.write')
  save(
    @Param('id', ParseUUIDPipe)
    id: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Headers('idempotency-key')
    key: string | undefined,

    @Body()
    dto: SaveLabResultDto,
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.results.save(id, staff.user.id, key, dto);
  }
}
