import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { FormulariosService } from './formularios.service';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('formularios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormulariosController {
  constructor(private readonly formulariosService: FormulariosService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createFormularioDto: CreateFormularioDto, @Req() req: RequestWithUser) {
    const usuarioId = req.user.id;
    return this.formulariosService.create(createFormularioDto, usuarioId);
  }

  @Post(':id/clonar-a-periodo/:periodoNuevoId')
  @Roles('COORDINADOR_CARRERA', 'COORDINADOR_BIENESTAR')
  clonarAPeriodo(
    @Param('id') id: string,
    @Param('periodoNuevoId') periodoNuevoId: string,
    @Req() req: RequestWithUser,
  ) {
    const usuarioId = req.user.id;
    return this.formulariosService.clonarHaciaNuevoPeriodo(id, periodoNuevoId, usuarioId);
  }

  @Post(':id/publicar')
  @Roles('COORDINADOR_BIENESTAR')
  publicar(@Param('id') id: string) {
    return this.formulariosService.publicarFormulario(id);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.formulariosService.findAll(skip, take);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string) {
    return this.formulariosService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateFormularioDto: UpdateFormularioDto) {
    return this.formulariosService.update(id, updateFormularioDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.formulariosService.remove(id);
  }
}