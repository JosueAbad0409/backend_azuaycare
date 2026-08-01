import { Controller, Get, Param, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  // 🆕 Endpoint que el frontend ya está esperando
  @Get('estadisticas/periodo/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerEstadisticasPeriodo(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerEstadisticasPeriodo(periodoId);
  }

  // 🆕 Descarga real del Excel
  @Get('socioeconomico/periodo/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  async descargarMatrizExcel(@Param('periodoId') periodoId: string, @Res() res: Response) {
    const { buffer, nombrePeriodo } = await this.reportesService.generarMatrizSocioeconomicaExcel(periodoId);
    const nombreArchivo = `Matriz_Socioeconomica_${nombrePeriodo.replace(/\s+/g, '_')}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}