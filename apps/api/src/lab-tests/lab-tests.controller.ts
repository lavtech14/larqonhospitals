import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import {
  CreateLabTestDto,
  ListLabTestsDto,
  UpdateLabTestDto,
} from './lab-test.dto.js';

import { LabTestsService } from './lab-tests.service.js';

@Controller('lab-tests')
export class LabTestsController {
  constructor(private readonly labTests: LabTestsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab-tests.read')
  list(@Query() query: ListLabTestsDto) {
    return this.labTests.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab-tests.read')
  get(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.labTests.get(id);
  }

  @Post()
  @RequirePermissions('lab-tests.manage')
  create(
    @CurrentStaff()
    staff: { user: { id: string } },

    @Body()
    dto: CreateLabTestDto,
  ) {
    return this.labTests.create(staff.user.id, dto);
  }

  @Put(':id')
  @RequirePermissions('lab-tests.manage')
  update(
    @Param('id', ParseUUIDPipe)
    id: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Body()
    dto: UpdateLabTestDto,
  ) {
    return this.labTests.update(id, staff.user.id, dto);
  }
}
