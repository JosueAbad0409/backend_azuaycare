import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles('COORDINADOR_BIENESTAR')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.auditoriaService.findAll(+skip, +take);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('id') id: string) {
    return this.auditoriaService.findOne(id);
  }
}