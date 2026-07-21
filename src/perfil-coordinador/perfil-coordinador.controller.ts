import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { PerfilCoordinadorService } from './perfil-coordinador.service';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';
import { UpdatePerfilCoordinadorDto } from './dto/update-perfil-coordinador.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('perfil-coordinador')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerfilCoordinadorController {
  constructor(private readonly perfilCoordinadorService: PerfilCoordinadorService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  create(@Body() createPerfilCoordinadorDto: CreatePerfilCoordinadorDto) {
    return this.perfilCoordinadorService.create(createPerfilCoordinadorDto);
  }

  // Cambiamos la ruta para que sea semánticamente correcta y usamos usuarioId
  @Get('usuario/:usuarioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByUsuario(@Param('usuarioId') usuarioId: string) {
    return this.perfilCoordinadorService.findByUsuario(usuarioId);
  }

  // Actualizamos en base al usuarioId, tal como lo pide el servicio
  @Patch('usuario/:usuarioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  update(
    @Param('usuarioId') usuarioId: string, 
    @Body() updatePerfilCoordinadorDto: UpdatePerfilCoordinadorDto
  ) {
    return this.perfilCoordinadorService.update(usuarioId, updatePerfilCoordinadorDto);
  }
}