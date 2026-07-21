import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  // La auditoría suele ser de solo lectura mediante la API, la creación ocurre internamente
  @Get()
  @Roles('COORDINADOR_BIENESTAR')
  findAll() {
    return this.auditoriaService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('id') id: string) {
    return this.auditoriaService.findOne(id);
  }
}
