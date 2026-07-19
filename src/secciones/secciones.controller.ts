import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { SeccionesService } from './secciones.service';
import { CreateSeccionDto } from './dto/create-secciones.dto'; 
import { UpdateSeccionDto } from './dto/update-secciones.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('secciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeccionesController {
  constructor(private readonly seccionesService: SeccionesService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createSeccionDto: CreateSeccionDto, @Req() req: any) {
    return this.seccionesService.create(createSeccionDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll() {
    return this.seccionesService.findAll();
  }

  @Get('formulario/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByFormulario(@Param('formularioId') formularioId: string) {
    return this.seccionesService.findByFormulario(formularioId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.seccionesService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateSeccionDto: UpdateSeccionDto, @Req() req: any) {
    return this.seccionesService.update(id, updateSeccionDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.seccionesService.remove(id);
  }
}