import { Controller, Get, Header } from '@nestjs/common';
import { RequirePermissions } from './permissions.js';

@Controller('access-check')
export class AccessCheckController {
  @RequirePermissions('patients.demographics.read')
  @Get('patient-directory')
  @Header('Cache-Control', 'no-store')
  checkPatientDirectory() {
    return {
      allowed: true,
      permission: 'patients.demographics.read',
    };
  }

  @RequirePermissions('patients.demographics.create')
  @Get('patient-registration')
  @Header('Cache-Control', 'no-store')
  checkPatientRegistration() {
    return {
      allowed: true,
      permission: 'patients.demographics.create',
    };
  }
}
