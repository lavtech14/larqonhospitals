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

import { CollectLabSampleDto, LabQueueDto } from './lab.dto.js';

import { LabService } from './lab.service.js';

@Controller('lab')
export class LabController {
  constructor(private readonly lab: LabService) {}

  @Get('orders')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab.queue.read')
  queue(@Query() query: LabQueueDto) {
    return this.lab.queue(query);
  }

  @Post('orders/:orderId/items/:itemId/collect')
  @HttpCode(200)
  @RequirePermissions('lab.queue.read', 'lab.samples.collect')
  collect(
    @Param('orderId', ParseUUIDPipe)
    orderId: string,

    @Param('itemId', ParseUUIDPipe)
    itemId: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Headers('idempotency-key')
    key: string | undefined,

    @Body()
    dto: CollectLabSampleDto,
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.lab.collect(orderId, itemId, staff.user.id, key, dto);
  }
}
