import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { RespuestasFormularioService } from './respuestas-formulario.service';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('respuestas-formulario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RespuestasFormularioController {
  constructor(private readonly respuestasService: RespuestasFormularioService) {}

  @Post('enviar-bloque')
  @Roles('ESTUDIANTE', 'INVITADO')
  createBulk(@Body() createDtos: CreateRespuestasFormularioDto[], @Req() req: any) {
    return this.respuestasService.guardarMuchas(createDtos, req.user.id);
  }

  @Get('mis-respuestas/formulario/:formularioId')
  @Roles('ESTUDIANTE', 'INVITADO', 'COORDINADOR_BIENESTAR')
  findMisRespuestas(@Param('formularioId') formularioId: string, @Req() req: any) {
    return this.respuestasService.findByUsuarioYFormulario(req.user.id, formularioId);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR')
  findAll() {
    return this.respuestasService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.respuestasService.findOne(id);
  }
}