import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TiposFormularioService } from './tipos-formulario.service';
import { CreateTipoFormularioDto } from './dto/create-tipo-formulario.dto';
import { UpdateTipoFormularioDto } from './dto/update-tipo-formulario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tipos-formulario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TiposFormularioController {
  constructor(private readonly tiposFormularioService: TiposFormularioService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateTipoFormularioDto) {
    return this.tiposFormularioService.create(createDto);
  }

  // Lectura abierta a más roles porque el selector de "Tipo de Formulario" en el
  // formulario de creación de fichas lo va a necesitar (coordinadores, y a futuro estudiantes).
  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(@Query('skip') skip = 0, @Query('take') take = 50) {
    return this.tiposFormularioService.findAll(skip, take);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.tiposFormularioService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateDto: UpdateTipoFormularioDto) {
    return this.tiposFormularioService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.tiposFormularioService.remove(id);
  }
}