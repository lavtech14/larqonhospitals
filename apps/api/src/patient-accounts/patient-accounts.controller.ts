import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { CreatePatientAccountDto } from './create-patient-account.dto.js';
import { PatientAccountsService } from './patient-accounts.service.js';

@Controller('patients/:patientId/account')
export class PatientAccountsController {
  constructor(private readonly accounts: PatientAccountsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('patients.account.manage', 'patients.demographics.read')
  get(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.accounts.get(patientId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('patients.account.manage', 'patients.demographics.read')
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreatePatientAccountDto,
    @CurrentStaff() staff: { user: { id: string } },
  ) {
    return this.accounts.create(patientId, dto, staff.user.id);
  }
}
