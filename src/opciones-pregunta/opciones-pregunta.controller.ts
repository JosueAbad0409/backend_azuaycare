import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { OpcionesPreguntaService } from './opciones-pregunta.service';
import { CreateOpcionPreguntaDto } from './dto/create-opciones-pregunta.dto'; 
import { UpdateOpcionPreguntaDto } from './dto/update-opciones-pregunta.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('opciones-pregunta')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpcionesPreguntaController {
  constructor(private readonly opcionesPreguntaService: OpcionesPreguntaService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createOpcionPreguntaDto: CreateOpcionPreguntaDto, @Req() req: any) {
    return this.opcionesPreguntaService.create(createOpcionPreguntaDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll() {
    return this.opcionesPreguntaService.findAll();
  }

  @Get('pregunta/:preguntaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByPregunta(@Param('preguntaId') preguntaId: string) {
    return this.opcionesPreguntaService.findByPregunta(preguntaId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.opcionesPreguntaService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateOpcionPreguntaDto: UpdateOpcionPreguntaDto, @Req() req: any) {
    return this.opcionesPreguntaService.update(id, updateOpcionPreguntaDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.opcionesPreguntaService.remove(id);
  }
}