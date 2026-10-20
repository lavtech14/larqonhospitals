import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentStaff } from '../auth/auth.decorators.js';
import type { CurrentStaffIdentity } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { ListClosuresDto, SaveClosureDto } from './closure.dto.js';
import { ClosureService } from './closure.service.js';

@Controller('doctors/:doctorId/closures')
export class DoctorClosureController {
  constructor(private readonly closures: ClosureService) {}

  @RequirePermissions('availability.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('doctorId', new ParseUUIDPipe({ version: '4' }))
    doctorId: string,
    @Query() query: ListClosuresDto,
  ) {
    return this.closures.list(doctorId, query);
  }

  @RequirePermissions('availability.manage')
  @Put()
  @Header('Cache-Control', 'no-store')
  save(
    @Param('doctorId', new ParseUUIDPipe({ version: '4' }))
    doctorId: string,
    @Body() dto: SaveClosureDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.closures.save(doctorId, dto, identity.user.id);
  }
}

@Controller('calendar/closures')
export class HospitalClosureController {
  constructor(private readonly closures: ClosureService) {}

  @RequirePermissions('availability.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListClosuresDto) {
    return this.closures.list(null, query);
  }

  @RequirePermissions('availability.manage')
  @Put()
  @Header('Cache-Control', 'no-store')
  save(
    @Body() dto: SaveClosureDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.closures.save(null, dto, identity.user.id);
  }
}
