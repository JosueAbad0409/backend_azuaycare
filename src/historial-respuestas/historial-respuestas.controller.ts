import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HistorialRespuestasService } from './historial-respuestas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('historial-respuestas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HistorialRespuestasController {
  constructor(private readonly historialService: HistorialRespuestasService) {}

  @Get('respuesta/:respuestaId')
  @Roles('COORDINADOR_BIENESTAR')
  findByRespuesta(@Param('respuestaId') respuestaId: string) {
    return this.historialService.findByRespuesta(respuestaId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('id') id: string) {
    return this.historialService.findOne(id);
  }
}
