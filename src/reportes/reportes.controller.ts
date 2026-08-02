import { Controller, Get, Post, Body, Param, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FiltroReporteDto } from './dto/filtro-reporte.dto';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('dashboard-resumen')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerDashboardResumen() {
    return this.reportesService.obtenerDashboardResumen();
  }

  @Get('estructura-agregada/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerEstructuraAgregada(@Param('formularioId') formularioId: string) {
    return this.reportesService.obtenerEstructuraAgregada(formularioId);
  }

  @Get('filtros-disponibles/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerFiltrosDisponibles(@Param('formularioId') formularioId: string) {
    return this.reportesService.obtenerFiltrosDisponibles(formularioId);
  }

  @Post('dataset-filtrado')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerDatasetFiltrado(@Body() filtros: FiltroReporteDto) {
    return this.reportesService.obtenerDatasetFiltrado(filtros);
  }

  @Post('dataset-filtrado/excel')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  async descargarDatasetFiltradoExcel(@Body() filtros: FiltroReporteDto, @Res() res: Response) {
    const { buffer, nombrePeriodo } = await this.reportesService.generarDatasetFiltradoExcel(filtros);
    const nombreArchivo = `Dataset_Filtrado_${nombrePeriodo.replace(/\s+/g, '_')}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post('dataset-filtrado/pdf')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  async descargarDatasetFiltradoPdf(@Body() filtros: FiltroReporteDto, @Res() res: Response) {
    const buffer = await this.reportesService.generarReporteFiltradoPdf(filtros);
    const nombreArchivo = `Reporte_Filtrado_${Date.now()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('dataset-plano/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerDatasetPlano(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerDatasetPlano(periodoId);
  }

  @Get('dataset-plano/:periodoId/excel')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  async descargarExcelStream(@Param('periodoId') periodoId: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Reporte_AzuayCare_${periodoId}.xlsx"`);
    
    await this.reportesService.descargarExcelStream(periodoId, res);
  }

  @Get('formularios-disponibles/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerFormulariosDisponibles(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerFormulariosDisponibles(periodoId);
  }

  @Get('estadisticas/periodo/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  obtenerEstadisticasPeriodo(@Param('periodoId') periodoId: string) {
    return this.reportesService.obtenerEstadisticasPeriodo(periodoId);
  }

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