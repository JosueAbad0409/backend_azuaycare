import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { PerfilCoordinadorService } from './perfil-coordinador.service';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';
import { UpdatePerfilCoordinadorDto } from './dto/update-perfil-coordinador.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@Controller('perfil-coordinador')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerfilCoordinadorController {
  constructor(private readonly perfilCoordinadorService: PerfilCoordinadorService) {}

  @Get('ayuda-estudiante')
  @Roles('ESTUDIANTE', 'INVITADO')
  getAyudaEstudiante(@Req() req: RequestWithUser) {
    return this.perfilCoordinadorService.getAyudaParaEstudiante(req.user.id);
  }

  @Post()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  create(@Body() createPerfilCoordinadorDto: CreatePerfilCoordinadorDto) {
    return this.perfilCoordinadorService.create(createPerfilCoordinadorDto);
  }

  @Get('usuario/:usuarioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByUsuario(@Param('usuarioId') usuarioId: string) {
    return this.perfilCoordinadorService.findByUsuario(usuarioId);
  }

  @Patch('usuario/:usuarioId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  update(
    @Param('usuarioId') usuarioId: string, 
    @Body() updatePerfilCoordinadorDto: UpdatePerfilCoordinadorDto
  ) {
    return this.perfilCoordinadorService.update(usuarioId, updatePerfilCoordinadorDto);
  }
}