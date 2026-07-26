import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('estructura-agregada/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerEstructuraAgregada(@Param('formularioId') formularioId: string) {
    return this.reportesService.obtenerEstructuraAgregada(formularioId);
  }

  @Get('dataset-plano/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerDatasetPlano(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerDatasetPlano(periodoId);
  }

  @Get('formularios-disponibles/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerFormulariosDisponibles(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerFormulariosDisponibles(periodoId);
  }
}