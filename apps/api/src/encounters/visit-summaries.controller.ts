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
} from '@nestjs/common';

import { isUUID } from 'class-validator';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import { PublishVisitSummaryDto } from './publish-visit-summary.dto.js';
import { VisitSummariesService } from './visit-summaries.service.js';

@Controller('doctor/appointments')
export class VisitSummariesController {
  constructor(private readonly summaries: VisitSummariesService) {}

  @Get(':id/encounter/summary')
  @RequirePermissions('encounters.own.read')
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff()
    staff: {
      user: {
        id: string;
      };
    },
  ) {
    return this.summaries.read(id, staff.user.id);
  }

  @Post(':id/encounter/summary/publish')
  @HttpCode(200)
  @RequirePermissions('encounters.own.read', 'encounters.own.publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishVisitSummaryDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentStaff()
    staff: {
      user: {
        id: string;
      };
    },
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.summaries.publish(id, staff.user.id, key, dto);
  }
}
