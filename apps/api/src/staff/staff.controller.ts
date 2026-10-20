import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { CreateStaffDto, ListStaffDto } from './staff.dto.js';
import { StaffService } from './staff.service.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('staff.manage', 'staff.read')
  create(
    @Body() dto: CreateStaffDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.staffService.create(dto, staff.user.id);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('staff.read')
  list(@Query() query: ListStaffDto) {
    return this.staffService.list(query);
  }
}
