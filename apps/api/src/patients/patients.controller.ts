import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentStaff } from '../auth/auth.decorators.js';
import type { CurrentStaffIdentity } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { CreatePatientDto } from './dto/create-patient.dto.js';
import { ListPatientsDto } from './dto/list-patients.dto.js';
import { PatientsService } from './patients.service.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { BadRequestException } from '@nestjs/common';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}
  @RequirePermissions(
    'patients.demographics.create',
    'patients.demographics.read',
  )
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const requestKey = await new ParseUUIDPipe({
      version: '4',
    }).transform(idempotencyKey, {
      type: 'custom',
      data: 'idempotency-key',
    });

    if (typeof requestKey !== 'string') {
      throw new BadRequestException('Idempotency-Key header is required.');
    }

    return this.patients.create(dto, identity.user.id, requestKey);
  }

  @RequirePermissions('patients.demographics.read')
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListPatientsDto) {
    return this.patients.list(query);
  }

  @RequirePermissions('patients.demographics.read')
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.patients.findOne(id, identity.user.id);
  }

  @RequirePermissions('patients.demographics.update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentStaff() identity: CurrentStaffIdentity,
  ) {
    return this.patients.update(id, dto, identity.user.id);
  }
}
