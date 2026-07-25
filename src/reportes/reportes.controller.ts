import { Controller, Get, Param, UseGuards } from '@nestjs/common';
// 🔒 Ya no necesitamos 'Res' ni 'Response' de express
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
  ) {
    return this.reportesService.obtenerDatosReporteDinamico(periodoId);
  }
}