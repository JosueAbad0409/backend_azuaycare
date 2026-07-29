import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CoordinadoresCarrerasService } from './coordinadores-carreras.service';
import { CreateCoordinadoresCarreraDto } from './dto/create-coordinadores-carrera.dto';
import { UpdateCoordinadoresCarreraDto } from './dto/update-coordinadores-carrera.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('coordinadores-carreras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoordinadoresCarrerasController {
  constructor(private readonly coordinadoresService: CoordinadoresCarrerasService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateCoordinadoresCarreraDto) {
    return this.coordinadoresService.create(createDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.coordinadoresService.findAll(+skip, +take);
  }

  @Get(':usuario_id/:carrera_id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('usuario_id') usuario_id: string, @Param('carrera_id') carrera_id: string) {
    return this.coordinadoresService.findOne(usuario_id, carrera_id);
  }

  @Patch(':usuario_id/:carrera_id')
  @Roles('COORDINADOR_BIENESTAR')
  update(
    @Param('usuario_id') usuario_id: string, 
    @Param('carrera_id') carrera_id: string, 
    @Body() updateDto: UpdateCoordinadoresCarreraDto
  ) {
    return this.coordinadoresService.update(usuario_id, carrera_id, updateDto);
  }

  @Delete(':usuario_id/:carrera_id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('usuario_id') usuario_id: string, @Param('carrera_id') carrera_id: string) {
    return this.coordinadoresService.remove(usuario_id, carrera_id);
  }
}