import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createGlobalValidationPipe } from './shared/validation-pipe.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
