import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // ajusta la ruta
import { RolesGuard } from '../auth/guards/roles.guard';     // ajusta si existe
import { Roles } from '../auth/decorators/roles.decorator'; // ajusta si existe

@Controller('ia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COORDINADOR_BIENESTAR')
export class IaController {
  constructor(private readonly iaService: IaService) { }

  @Post('chat')
  async chat(@Body('prompt') prompt: string) {
    if (!prompt?.trim()) {
      return { error: 'El prompt es requerido' };
    }
    return this.iaService.procesarMensaje(prompt.trim());
    // → { response, fuentes }
  }
}