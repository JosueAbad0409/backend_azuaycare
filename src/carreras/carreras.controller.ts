import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CarrerasService } from './carreras.service';
import { CreateCarreraDto } from './dto/create-carrera.dto';
import { UpdateCarreraDto } from './dto/update-carrera.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('carreras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CarrerasController {
  constructor(private readonly carrerasService: CarrerasService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createCarreraDto: CreateCarreraDto) {
    return this.carrerasService.create(createCarreraDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll() {
    return this.carrerasService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.carrerasService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateCarreraDto: UpdateCarreraDto) {
    return this.carrerasService.update(id, updateCarreraDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.carrerasService.remove(id);
  }
}