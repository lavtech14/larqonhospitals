import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { CheckInDto } from './check-in.dto.js';
import { EncountersService } from './encounters.service.js';
import { ListNursingQueueDto } from './list-nursing-queue.dto.js';
import { MarkReadyDto } from './mark-ready.dto.js';

@Controller()
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Post('appointments/:id/check-in')
  @HttpCode(200)
  @RequirePermissions('encounters.check-in', 'appointments.read')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.encounters.checkIn(id, dto, staff.user.id);
  }

  @Get('nursing/queue')
  @RequirePermissions('nursing.queue.read')
  queue(@Query() query: ListNursingQueueDto) {
    return this.encounters.listQueue(query);
  }

  @Post('encounters/:id/ready')
  @HttpCode(200)
  @RequirePermissions('encounters.vitals.record', 'nursing.queue.read')
  markReady(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkReadyDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.encounters.markReady(id, dto, staff.user.id);
  }
}
