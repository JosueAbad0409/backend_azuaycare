import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express'; // 👈 Solo agrega la palabra "type" aquí
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('socioeconomico/periodo/:periodoId')
  @Roles('COORDINADOR_BIENESTAR')
  async descargarReporteSocioeconomico(
    @Param('periodoId') periodoId: string,
    @Res() res: Response,
  ) {
    return this.reportesService.exportarSocioeconomicoExcel(res, periodoId);
  }
}