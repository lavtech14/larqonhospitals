import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });

  app.use(cookieParser());

  // Reject browser mutations from unexpected or missing origins.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      request.method,
    );

    if (mutating && request.get('origin') !== frontendOrigin) {
      response.status(403).json({
        message: 'Request origin is not allowed.',
      });
      return;
    }

    next();
  });

  app.use(
    ['/api/auth/login', '/api/auth/change-password'],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      message: {
        message: 'Too many login attempts. Try again later.',
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  await app.listen(3001, '127.0.0.1');

  console.log('Larqon Hospitals API: http://localhost:3001/api');
}

void bootstrap();
