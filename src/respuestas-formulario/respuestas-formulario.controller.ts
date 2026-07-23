import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { RespuestasFormularioService } from './respuestas-formulario.service';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('respuestas-formulario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RespuestasFormularioController {
  constructor(private readonly respuestasService: RespuestasFormularioService) {}

  @Post('enviar-bloque')
  @Roles('ESTUDIANTE', 'INVITADO')
  createBulk(@Body() createDtos: CreateRespuestasFormularioDto[], @Req() req: RequestWithUser) {
    return this.respuestasService.guardarMuchas(createDtos, req.user.id);
  }

  @Get('ficha/:fichaId')
  @Roles('ESTUDIANTE', 'INVITADO', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findByFicha(@Param('fichaId') fichaId: string) {
    return this.respuestasService.findByFicha(fichaId);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.respuestasService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.respuestasService.findOne(id);
  }
}
