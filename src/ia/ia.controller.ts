import { Controller, Post, Body } from '@nestjs/common';
import { IaService } from './ia.service';

@Controller('ia')  // → /api/ia/chat si hay global prefix "api"
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Post('chat')
  async chat(@Body('prompt') prompt: string) {
    if (!prompt?.trim()) {
      return { error: 'El prompt es requerido' };
    }
    const respuesta = await this.iaService.procesarMensaje(prompt.trim());
    return { response: respuesta };
  }
}