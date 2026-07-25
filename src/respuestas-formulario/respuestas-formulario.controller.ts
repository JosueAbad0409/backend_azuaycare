import { Controller, Get, Post, Body, Param, UseGuards, Req, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express'; 
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
  @UseInterceptors(FilesInterceptor('archivos')) 
  createBulk(
    // 🔒 Al usar multipart/form-data para enviar archivos, el array de DTOs suele llegar como un string JSON
    @Body('respuestas') respuestasData: string | CreateRespuestasFormularioDto[], 
    @Req() req: RequestWithUser,
    @UploadedFiles() archivos: Express.Multer.File[] // 🔒 Captura los archivos
  ) {
    // Parseamos la data si el frontend la envió como string (común en FormData)
    const createDtos: CreateRespuestasFormularioDto[] = typeof respuestasData === 'string' 
      ? JSON.parse(respuestasData) 
      : respuestasData;

    // Pasamos los DTOs, el usuario y los archivos al servicio para la transacción completa
    return this.respuestasService.guardarMuchas(createDtos, req.user.id, archivos);
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
    // 🔥 SOLUCIÓN: Pasamos los parámetros al servicio. 
    // Usamos el signo "+" (+skip, +take) para asegurar que NestJS los trate como números y no como strings.
    return this.respuestasService.findAll(+skip, +take);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.respuestasService.findOne(id);
  }
}