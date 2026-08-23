import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CiclosService } from './ciclos.service';
import { CreateCicloDto } from './dto/create-ciclo.dto';
import { UpdateCicloDto } from './dto/update-ciclo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('ciclos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CiclosController {
  constructor(private readonly ciclosService: CiclosService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createCicloDto: CreateCicloDto) {
    return this.ciclosService.create(createCicloDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(@Query('skip') skip = 0, @Query('take') take = 1000) {
    return this.ciclosService.findAll(+skip, +take);
  }


  @Get('carrera/:carreraId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByCarrera(@Param('carreraId') carreraId: string) {
    return this.ciclosService.findByCarrera(carreraId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.ciclosService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateCicloDto: UpdateCicloDto) {
    return this.ciclosService.update(id, updateCicloDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.ciclosService.remove(id);
  }
}