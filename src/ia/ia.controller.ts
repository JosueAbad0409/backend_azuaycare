import { Controller, Post, Body } from '@nestjs/common';
import { IaService } from './ia.service';

@Controller('api/ia')
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Post('chat')
  async chat(@Body('prompt') prompt: string) {
    if (!prompt) {
      return { error: 'El prompt es requerido' };
    }
    const respuesta = await this.iaService.procesarMensaje(prompt);
    return { response: respuesta };
  }
}