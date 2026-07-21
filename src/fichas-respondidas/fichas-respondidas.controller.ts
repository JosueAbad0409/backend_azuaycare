import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FichasRespondidasService } from './fichas-respondidas.service';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('fichas-respondidas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FichasRespondidasController {
  constructor(private readonly fichasService: FichasRespondidasService) {}

  @Post()
  @Roles('ESTUDIANTE', 'INVITADO')
  create(@Body() createDto: CreateFichaRespondidaDto, @Req() req: any) {
    return this.fichasService.create(createDto, req.user.id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll() {
    return this.fichasService.findAll();
  }

  @Get('mis-fichas')
  @Roles('ESTUDIANTE', 'INVITADO')
  findMisFichas(@Req() req: any) {
    return this.fichasService.findByUsuario(req.user.id);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.fichasService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  update(@Param('id') id: string, @Body() updateDto: UpdateFichaRespondidaDto) {
    return this.fichasService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  remove(@Param('id') id: string) {
    return this.fichasService.remove(id);
  }
}
