import { Controller, Get, Head } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @Head()
  check() {
    return { status: 'ok' }; // 🔧 No toca la DB, responde rápido para "despertar" el contenedor
  }
}