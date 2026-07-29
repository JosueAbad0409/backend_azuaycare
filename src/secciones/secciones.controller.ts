import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { SeccionesService } from './secciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSeccionDto } from './dto/create-secciones.dto';
import { UpdateSeccionDto } from './dto/update-secciones.dto';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('secciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeccionesController {
  constructor(private readonly seccionesService: SeccionesService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createSeccionDto: CreateSeccionDto, @Req() req: RequestWithUser) {
    return this.seccionesService.create(createSeccionDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.seccionesService.findAll(+skip, +take); // CORRECCIÓN
  }

  @Get('formulario/:formularioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByFormulario(@Param('formularioId') formularioId: string) {
    return this.seccionesService.findByFormulario(formularioId);
  }

  @Patch('reordenar')
  @Roles('COORDINADOR_BIENESTAR')
  reordenar(@Body() body: { formulario_id: string, ordenes: { id: string, orden: number }[] }) {
    return this.seccionesService.reordenar(body.formulario_id, body.ordenes);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.seccionesService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateSeccionDto: UpdateSeccionDto, @Req() req: RequestWithUser) {
    return this.seccionesService.update(id, updateSeccionDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.seccionesService.remove(id);
  }
}