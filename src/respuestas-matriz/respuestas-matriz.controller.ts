import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RespuestasMatrizService } from './respuestas-matriz.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('respuestas-matriz')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RespuestasMatrizController {
  constructor(private readonly respuestasMatrizService: RespuestasMatrizService) {}

  @Get('respuesta/:respuestaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByRespuesta(@Param('respuestaId') respuestaId: string) {
    return this.respuestasMatrizService.findByRespuesta(respuestaId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.respuestasMatrizService.findOne(id);
  }
}