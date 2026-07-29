import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { PreguntasService } from './preguntas.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('preguntas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreguntasController {
  constructor(private readonly preguntasService: PreguntasService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createPreguntaDto: CreatePreguntaDto, @Req() req: RequestWithUser) {
    return this.preguntasService.create(createPreguntaDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.preguntasService.findAll();
  }

  @Get('seccion/:seccionId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findBySeccion(@Param('seccionId') seccionId: string) {
    return this.preguntasService.findBySeccion(seccionId);
  }

  @Patch('reordenar')
  @Roles('COORDINADOR_BIENESTAR')
  reordenar(@Body() body: { seccion_id: string, ordenes: { id: string, orden: number }[] }) {
    return this.preguntasService.reordenar(body.seccion_id, body.ordenes);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.preguntasService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updatePreguntaDto: UpdatePreguntaDto, @Req() req: RequestWithUser) {
    return this.preguntasService.update(id, updatePreguntaDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.preguntasService.remove(id);
  }
}