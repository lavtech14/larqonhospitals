import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CurrentStaff } from '../auth/auth.decorators.js';
import type { CurrentStaffIdentity } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { SaveAvailabilityDto } from './availability.dto.js';
import { AvailabilityService } from './availability.service.js';

@Controller('doctors/:doctorId/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @RequirePermissions('availability.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  get(
    @Param('doctorId', new ParseUUIDPipe({ version: '4' }))
    doctorId: string,
  ) {
    return this.availability.get(doctorId);
  }

  @RequirePermissions('availability.manage')
  @Put()
  @Header('Cache-Control', 'no-store')
  save(
    @Param('doctorId', new ParseUUIDPipe({ version: '4' }))
    doctorId: string,
    @Body() dto: SaveAvailabilityDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.availability.save(doctorId, dto, identity.user.id);
  }
}
