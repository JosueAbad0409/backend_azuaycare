import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TiposCampoFormService } from './tipos-campo-form.service';
import { CreateTipoCampoFormDto } from './dto/create-tipos-campo-form.dto';
import { UpdateTipoCampoFormDto } from './dto/update-tipos-campo-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tipos-campo-form')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TiposCampoFormController {
  constructor(private readonly tiposCampoFormService: TiposCampoFormService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR')
  create(@Body() createDto: CreateTipoCampoFormDto) {
    return this.tiposCampoFormService.create(createDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll() {
    return this.tiposCampoFormService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findOne(@Param('id') id: string) {
    return this.tiposCampoFormService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateDto: UpdateTipoCampoFormDto) {
    return this.tiposCampoFormService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.tiposCampoFormService.remove(id);
  }
}