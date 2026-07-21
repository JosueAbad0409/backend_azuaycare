import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HistorialEstadosFichaService } from './historial-estados-ficha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('historial-estados-ficha')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HistorialEstadosFichaController {
  constructor(private readonly historialService: HistorialEstadosFichaService) {}

  @Get('ficha/:fichaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByFicha(@Param('fichaId') fichaId: string) {
    return this.historialService.findByFicha(fichaId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('id') id: string) {
    return this.historialService.findOne(id);
  }
}
