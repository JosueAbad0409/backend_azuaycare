import { 
  Controller, 
  Post, 
  Get,
  Patch,
  Delete,
  UseInterceptors, 
  UploadedFile, 
  Body, 
  ParseFilePipe, 
  MaxFileSizeValidator, 
  FileTypeValidator,
  UseGuards,
  Req,
  Param
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentosRespaldoService } from './documentos-respaldo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('documentos-respaldo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosRespaldoController {
  constructor(private readonly documentosService: DocumentosRespaldoService) {}

  @Post('upload')
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  @UseInterceptors(FileInterceptor('file'))
  async subirDocumento(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }), // 10MB máximo
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }), 
        ],
      }),
    ) file: Express.Multer.File,
  ) {
    // 🚀 ELIMINAMOS la validación del respuesta_id. 
    // Ahora solo recibimos el archivo y lo enviamos al nuevo método del servicio.
    return await this.documentosService.subirUnArchivoTemporal(file);
  }

  @Get('respuesta/:respuestaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByRespuesta(@Param('respuestaId') respuestaId: string, @Req() req: RequestWithUser) {
    return this.documentosService.findByRespuesta(respuestaId, req.user.id, req.user.rol);
  }

  @Get('ficha/:fichaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByFicha(@Param('fichaId') fichaId: string, @Req() req: RequestWithUser) {
    return this.documentosService.findByFicha(fichaId, req.user.id, req.user.rol);
  }

  @Patch(':id/verificar')
  @Roles('COORDINADOR_BIENESTAR')
  verificar(
    @Param('id') id: string, 
    @Body() body: { verificado: boolean; observacion?: string }, 
    @Req() req: RequestWithUser
  ) {
    return this.documentosService.verificar(id, body.verificado, body.observacion, req.user.id);
  }

  @Delete(':id')
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentosService.remove(id, req.user.id, req.user.rol);
  }
}