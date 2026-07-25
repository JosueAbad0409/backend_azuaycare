import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { FichasRespondidasService } from './fichas-respondidas.service';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@Controller('fichas-respondidas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FichasRespondidasController {
  constructor(private readonly fichasService: FichasRespondidasService) {}

  @Post()
  @Roles('ESTUDIANTE', 'INVITADO')
  create(@Body() createDto: CreateFichaRespondidaDto, @Req() req: RequestWithUser) {
    return this.fichasService.create(createDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.fichasService.findAll(+skip, +take);
  }

  @Get('mis-fichas')
  @Roles('ESTUDIANTE', 'INVITADO')
  findMisFichas(@Req() req: RequestWithUser) {
    return this.fichasService.findByUsuario(req.user.id);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Pasamos el usuario para validar propiedad
    return this.fichasService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  update(@Param('id') id: string, @Body() updateDto: UpdateFichaRespondidaDto, @Req() req: RequestWithUser) {
    return this.fichasService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.fichasService.remove(id, req.user);
  }

  // Nuevo endpoint exclusivo para coordinadores
  @Patch(':id/estado')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  cambiarEstado(@Param('id') id: string, @Body('estado_ficha') estado: string) {
    return this.fichasService.cambiarEstado(id, estado);
  }
}