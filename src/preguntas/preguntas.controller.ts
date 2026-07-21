import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { PreguntasService } from './preguntas.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('preguntas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreguntasController {
  constructor(private readonly preguntasService: PreguntasService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createPreguntaDto: CreatePreguntaDto, @Req() req: any) {
    return this.preguntasService.create(createPreguntaDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll() {
    return this.preguntasService.findAll();
  }

  @Get('seccion/:seccionId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findBySeccion(@Param('seccionId') seccionId: string) {
    return this.preguntasService.findBySeccion(seccionId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.preguntasService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updatePreguntaDto: UpdatePreguntaDto, @Req() req: any) {
    return this.preguntasService.update(id, updatePreguntaDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.preguntasService.remove(id);
  }
}
