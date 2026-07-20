import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MatricesFormService } from './matrices-form.service';
import { CreateFilaMatrizDto, CreateColumnaMatrizDto } from './dto/create-matrices-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('matrices-form')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatricesFormController {
  constructor(private readonly matricesService: MatricesFormService) {}

  @Post('fila')
  @Roles('COORDINADOR_BIENESTAR')
  createFila(@Body() dto: CreateFilaMatrizDto) {
    return this.matricesService.createFila(dto);
  }

  @Post('columna')
  @Roles('COORDINADOR_BIENESTAR')
  createColumna(@Body() dto: CreateColumnaMatrizDto) {
    return this.matricesService.createColumna(dto);
  }

  @Get('pregunta/:preguntaId/estructura')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  async getEstructuraMatriz(@Param('preguntaId') preguntaId: string) {
    const [filas, columnas] = await Promise.all([
      this.matricesService.findFilasByPregunta(preguntaId),
      this.matricesService.findColumnasByPregunta(preguntaId),
    ]);
    return { filas, columnas };
  }
}