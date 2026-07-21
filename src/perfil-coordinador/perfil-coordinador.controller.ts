import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PerfilCoordinadorService } from './perfil-coordinador.service';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';
import { UpdatePerfilCoordinadorDto } from './dto/update-perfil-coordinador.dto';

@Controller('perfil-coordinador')
export class PerfilCoordinadorController {
  constructor(private readonly perfilCoordinadorService: PerfilCoordinadorService) {}

  @Post()
  create(@Body() createPerfilCoordinadorDto: CreatePerfilCoordinadorDto) {
    return this.perfilCoordinadorService.create(createPerfilCoordinadorDto);
  }

  @Get()
  findAll() {
    return this.perfilCoordinadorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.perfilCoordinadorService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePerfilCoordinadorDto: UpdatePerfilCoordinadorDto) {
    return this.perfilCoordinadorService.update(+id, updatePerfilCoordinadorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.perfilCoordinadorService.remove(+id);
  }
}
