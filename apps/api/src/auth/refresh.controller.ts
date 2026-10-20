import {
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from './auth.decorators.js';
import { clearAuthCookies, setAuthCookies } from './auth.cookies.js';
import { RefreshService } from './refresh.service.js';

@Controller('auth')
export class RefreshController {
  constructor(private readonly refreshService: RefreshService) {}

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, unknown> | undefined;

    try {
      const result = await this.refreshService.refresh(cookies?.larqon_refresh);

      setAuthCookies(response, result);

      return { user: result.user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        clearAuthCookies(response);
      }

      throw error;
    }
  }
}
