import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { PeriodosMatriculaService } from './periodos-matricula.service';
import { CreatePeriodoMatriculaDto } from './dto/create-periodos-matricula.dto';
import { UpdatePeriodoMatriculaDto } from './dto/update-periodos-matricula.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('periodos-matricula')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodosMatriculaController {
  constructor(private readonly periodosMatriculaService: PeriodosMatriculaService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  create(@Body() createDto: CreatePeriodoMatriculaDto, @Req() req: RequestWithUser) {
    return this.periodosMatriculaService.create(createDto, req.user?.id);
  }

  @Post('activar-nuevo')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  activarNuevoPeriodo(@Body() createDto: CreatePeriodoMatriculaDto, @Req() req: RequestWithUser) {
    return this.periodosMatriculaService.activarNuevoPeriodo(createDto, req.user.id);
  }

  @Patch(':id/bloquear')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  bloquear(@Param('id') id: string) {
    return this.periodosMatriculaService.cerrarYBloquear(id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.periodosMatriculaService.findAll(skip, take);
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