import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: 'http://localhost:3000',
  });

  await app.listen(3001, '127.0.0.1');

  console.log('Larqon Hospitals API: http://localhost:3001/api');
}

void bootstrap();
