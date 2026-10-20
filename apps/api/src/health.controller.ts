import { Controller, Get, Header } from '@nestjs/common';
import { Public } from './auth/auth.decorators.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  check() {
    return { status: 'ok' };
  }
}
