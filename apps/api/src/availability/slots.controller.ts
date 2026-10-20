import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../auth/permissions.js';
import { SlotQueryDto } from './slot-query.dto.js';
import { SlotsService } from './slots.service.js';

@Controller('doctors/:doctorId/slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('availability.read')
  list(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: SlotQueryDto,
  ) {
    return this.slotsService.list(doctorId, query.date);
  }
}
