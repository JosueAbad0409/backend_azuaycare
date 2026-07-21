import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { DocumentosRespaldoService } from './documentos-respaldo.service';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('documentos-respaldo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosRespaldoController {
  constructor(private readonly documentosService: DocumentosRespaldoService) {}

  @Post()
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateDocumentosRespaldoDto) {
    return this.documentosService.create(createDto);
  }

  @Get('respuesta/:respuestaId')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  findByRespuesta(@Param('respuestaId') respuestaId: string) {
    return this.documentosService.findByRespuesta(respuestaId);
  }

  @Delete(':id')
  @Roles('ESTUDIANTE', 'COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.documentosService.remove(id);
  }
}
