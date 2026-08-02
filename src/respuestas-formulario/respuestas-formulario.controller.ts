import { Controller, Get, Post, Body, Param, UseGuards, Req, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express'; 
import { SkipThrottle } from '@nestjs/throttler';
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

  @SkipThrottle() // <-- EXIME ESTA RUTA DEL LÍMITE GLOBAL (EVITA BLOQUEOS 429 EN AUTOGUARDADO / ENVIOS)
  @Post('enviar-bloque')
  @Roles('ESTUDIANTE', 'INVITADO')
  @UseInterceptors(FilesInterceptor('archivos')) 
  createBulk(
    @Body('respuestas') respuestasData: string | CreateRespuestasFormularioDto[], 
    @Body('es_envio_final') esEnvioFinal = 'false',
    @Req() req: RequestWithUser,
    @UploadedFiles() archivos: Express.Multer.File[]
  ) {
    const createDtos: CreateRespuestasFormularioDto[] = typeof respuestasData === 'string' 
      ? JSON.parse(respuestasData) 
      : respuestasData;

    const esFinal = esEnvioFinal === 'true' || esEnvioFinal === (true as any);

    return this.respuestasService.guardarMuchas(createDtos, req.user.id, archivos, esFinal);
  }

  @Get('precarga/:periodoNuevoId')
  @Roles('ESTUDIANTE', 'INVITADO')
  obtenerPrecarga(
    @Param('periodoNuevoId') periodoNuevoId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.respuestasService.obtenerPrecarga(periodoNuevoId, req.user.id);
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
    return this.respuestasService.findAll(+skip, +take);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.respuestasService.findOne(id);
  }
}