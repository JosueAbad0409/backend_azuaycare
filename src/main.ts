import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);

  try {
    await app.listen(port);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      await app.listen(0);
    } else {
      throw error;
    }
  }
}

void bootstrap();
