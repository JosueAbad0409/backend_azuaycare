import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' }; // 🔧 No toca la DB, responde rápido para "despertar" el contenedor
  }
}