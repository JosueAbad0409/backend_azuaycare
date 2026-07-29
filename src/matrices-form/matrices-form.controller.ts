import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
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

  @Get('filas/pregunta/:preguntaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findFilasByPregunta(@Param('preguntaId') preguntaId: string) {
    return this.matricesService.findFilasByPregunta(preguntaId);
  }

  @Get('columnas/pregunta/:preguntaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findColumnasByPregunta(@Param('preguntaId') preguntaId: string) {
    return this.matricesService.findColumnasByPregunta(preguntaId);
  }

  @Get('pregunta/:preguntaId/estructura')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  getEstructuraMatriz(@Param('preguntaId') preguntaId: string) {
    return this.matricesService.obtenerEstructuraMatriz(preguntaId);
  }

  @Delete('fila/:id')
  @Roles('COORDINADOR_BIENESTAR')
  removeFila(@Param('id') id: string) {
    return this.matricesService.removeFila(id);
  }

  @Delete('columna/:id')
  @Roles('COORDINADOR_BIENESTAR')
  removeColumna(@Param('id') id: string) {
    return this.matricesService.removeColumna(id);
  }
}