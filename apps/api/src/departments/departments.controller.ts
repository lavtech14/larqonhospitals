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
import {
  CreateDepartmentDto,
  ListDepartmentsDto,
  UpdateDepartmentDto,
} from './department.dto.js';
import { DepartmentsService } from './departments.service.js';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @RequirePermissions('departments.manage')
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.departments.create(dto, identity.user.id);
  }

  @RequirePermissions('departments.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListDepartmentsDto) {
    return this.departments.list(query);
  }
  @RequirePermissions('departments.read')
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.departments.findOne(id);
  }

  @RequirePermissions('departments.manage')
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.departments.update(id, dto, identity.user.id);
  }
}
