import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ 
    origin: [
      'http://localhost:8087', 
      'https://azuaycare.netlify.app'
    ], 
    credentials: true 
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);

  try {
    // Escucha en el puerto configurado y acepta conexiones externas ('0.0.0.0')
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      // Si el puerto está ocupado, escucha en cualquier puerto disponible externamente
      await app.listen(0, '0.0.0.0');
    } else {
      throw error;
    }
  }
}

void bootstrap();