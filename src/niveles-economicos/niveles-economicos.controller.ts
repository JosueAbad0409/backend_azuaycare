import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { NivelesEconomicosService } from './niveles-economicos.service';
import { CreateNivelesEconomicoDto } from './dto/create-niveles-economico.dto';
import { UpdateNivelesEconomicoDto } from './dto/update-niveles-economico.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('niveles-economicos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NivelesEconomicosController {
  constructor(private readonly nivelesService: NivelesEconomicosService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateNivelesEconomicoDto, @Req() req: any) {
    return this.nivelesService.create(createDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll() {
    return this.nivelesService.findAll();
  }

  @Get('periodo/:periodoId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findByPeriodo(@Param('periodoId') periodoId: string) {
    return this.nivelesService.findByPeriodo(periodoId);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.nivelesService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateDto: UpdateNivelesEconomicoDto, @Req() req: any) {
    return this.nivelesService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.nivelesService.remove(id);
  }
}