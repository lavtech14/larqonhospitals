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

import { LabQueueDto, RejectLabSampleDto } from './lab.dto.js';

import { LabSpecimensService } from './lab-specimens.service.js';

@Controller('lab/specimens')
export class LabSpecimensController {
  constructor(private readonly specimens: LabSpecimensService) {}

  @Get('rejection-queue')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab.queue.read')
  queue(@Query() query: LabQueueDto) {
    return this.specimens.queue(query);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('lab.queue.read', 'lab.samples.reject')
  reject(
    @Param('id', ParseUUIDPipe)
    id: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Headers('idempotency-key')
    key: string | undefined,

    @Body()
    dto: RejectLabSampleDto,
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.specimens.reject(id, staff.user.id, key, dto);
  }
}
