import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentStaff } from '../auth/auth.decorators.js';
import type { CurrentStaffIdentity } from '../auth/auth.decorators.js';
import { RequirePermissions } from '../auth/permissions.js';
import { ConsultationsService } from './consultations.service.js';

@RequirePermissions('appointments.own.read')
@Controller('appointments')
export class DoctorConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Post(':id/consultation/join')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  join(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.consultations.joinAsDoctor(identity.user.id, id);
  }

  @Get(':id/consultation')
  @Header('Cache-Control', 'no-store')
  status(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.consultations.statusAsDoctor(identity.user.id, id);
  }

  @Post(':id/consultation/end')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  end(
    @CurrentStaff() identity: CurrentStaffIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.consultations.endAsDoctor(identity.user.id, id);
  }
}
