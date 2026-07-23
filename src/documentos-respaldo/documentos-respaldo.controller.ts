import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { DocumentosRespaldoService } from './documentos-respaldo.service';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';

@Controller('documentos-respaldo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosRespaldoController {
  constructor(private readonly documentosService: DocumentosRespaldoService) {}

  @Post()
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateDocumentosRespaldoDto, @Req() req: RequestWithUser) {
    return this.documentosService.create(createDto, req.user.id, req.user.rol);
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