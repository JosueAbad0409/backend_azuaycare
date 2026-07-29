import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PlantillasPdfService } from './plantillas-pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePlantillaPdfDto } from './dto/create-plantillas-pdf.dto';

@Controller('plantillas-pdf')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlantillasPdfController {
  constructor(private readonly plantillasPdfService: PlantillasPdfService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  upsert(@Body() createDto: CreatePlantillaPdfDto) {
    return this.plantillasPdfService.upsert(createDto);
  }

  @Get('formulario/:formularioId')
  @Roles('COORDINADOR_BIENESTAR')
  findByFormulario(@Param('formularioId') formularioId: string) {
    return this.plantillasPdfService.findByFormulario(formularioId);
  }
}