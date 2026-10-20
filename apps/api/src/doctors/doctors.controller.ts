import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/auth.decorators.js';
import type { CurrentStaffIdentity } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import { DoctorsService } from './doctors.service.js';
import {
  CreateDoctorDto,
  ListDoctorsDto,
  UpdateDoctorDto,
} from './doctor.dto.js';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @RequirePermissions('doctors.manage')
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Body() dto: CreateDoctorDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.doctors.create(dto, identity.user.id);
  }

  @RequirePermissions('doctors.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListDoctorsDto) {
    return this.doctors.list(query);
  }
  @RequirePermissions('doctors.manage')
  @Get(':id/management')
  @Header('Cache-Control', 'no-store')
  managementDetails(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.doctors.findManagementDetails(id, identity.user.id);
  }

  @RequirePermissions('doctors.manage')
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.doctors.update(id, dto, identity.user.id);
  }
}
