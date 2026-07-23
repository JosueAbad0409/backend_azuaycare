import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { PeriodosMatriculaService } from './periodos-matricula.service';
import { CreatePeriodoMatriculaDto } from './dto/create-periodos-matricula.dto';
import { UpdatePeriodoMatriculaDto } from './dto/update-periodos-matricula.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('periodos-matricula')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodosMatriculaController {
  constructor(private readonly periodosMatriculaService: PeriodosMatriculaService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreatePeriodoMatriculaDto) {
    return this.periodosMatriculaService.create(createDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.periodosMatriculaService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.periodosMatriculaService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateDto: UpdatePeriodoMatriculaDto) { 
    return this.periodosMatriculaService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.periodosMatriculaService.remove(id);
  }
}