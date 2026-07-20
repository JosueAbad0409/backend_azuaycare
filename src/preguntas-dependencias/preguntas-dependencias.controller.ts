import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { PreguntasDependenciasService } from './preguntas-dependencias.service';
import { CreatePreguntaDependenciaDto } from './dto/create-pregunta-dependencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('preguntas-dependencias')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreguntasDependenciasController {
  constructor(private readonly dependenciasService: PreguntasDependenciasService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreatePreguntaDependenciaDto) {
    return this.dependenciasService.create(createDto);
  }

  @Get('formulario/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByFormulario(@Param('formularioId') formularioId: string) {
    return this.dependenciasService.findByFormulario(formularioId);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.dependenciasService.remove(id);
  }
}