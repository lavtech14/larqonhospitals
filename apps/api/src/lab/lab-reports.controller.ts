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
} from '@nestjs/common';

import { isUUID } from 'class-validator';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';

import { ReleaseLabReportDto } from './release-lab-report.dto.js';
import { LabReportsService } from './lab-reports.service.js';

@Controller('lab/samples')
export class LabReportsController {
  constructor(private readonly reports: LabReportsService) {}

  @Get(':id/release')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('lab.results.read')
  read(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.reports.read(id);
  }

  @Post(':id/release')
  @HttpCode(200)
  @RequirePermissions('lab.results.read', 'lab.results.release')
  release(
    @Param('id', ParseUUIDPipe)
    id: string,

    @CurrentStaff()
    staff: { user: { id: string } },

    @Headers('idempotency-key')
    key: string | undefined,

    @Body()
    dto: ReleaseLabReportDto,
  ) {
    if (typeof key !== 'string' || !isUUID(key)) {
      throw new BadRequestException(
        'A UUID Idempotency-Key header is required.',
      );
    }

    return this.reports.release(id, staff.user.id, key, dto);
  }
}
