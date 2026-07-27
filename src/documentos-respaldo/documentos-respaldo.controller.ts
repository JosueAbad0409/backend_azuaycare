import { 
  Controller, 
  Post, 
  Get,
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
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|pdf)' }),
        ],
      }),
    ) file: Express.Multer.File,
    @Body('respuesta_id') respuestaId: string,
    @Req() req: RequestWithUser,
  ) {
    // 1. Subir buffer a Supabase Storage mediante el servicio
    const [archivoSubido] = await this.documentosService.subirMultiples([file]);

    // 2. Registrar la evidencia en la base de datos asociándola a la respuesta
    return await this.documentosService.create(
      {
        respuesta_id: respuestaId,
        ruta_archivo: archivoSubido.ruta_archivo!,
        nombre_original: archivoSubido.nombre_original!,
        mime_type: archivoSubido.mime_type!,
        tamanio_bytes: archivoSubido.tamanio_bytes!,
      },
      req.user.id,
      req.user.rol,
    );
  }

  @Get('respuesta/:respuestaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByRespuesta(@Param('respuestaId') respuestaId: string, @Req() req: RequestWithUser) {
    return this.documentosService.findByRespuesta(respuestaId, req.user.id, req.user.rol);
  }

  @Delete(':id')
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentosService.remove(id, req.user.id, req.user.rol);
  }
}