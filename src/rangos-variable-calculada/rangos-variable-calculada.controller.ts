import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { RangosVariableCalculadaService } from './rangos-variable-calculada.service';
import { CreateRangoVariableCalculadaDto, SimularRangoDto } from './dto/create-rangos-variable-calculada.dto';


@Controller('rangos-variable-calculada')
export class RangosVariableCalculadaController {
  constructor(private readonly rangosService: RangosVariableCalculadaService) {}

  @Post()
  create(@Body() createDto: CreateRangoVariableCalculadaDto) {
    return this.rangosService.create(createDto);
  }

  @Post('simular')
  simular(@Body() simularDto: SimularRangoDto) {
    return this.rangosService.simularRango(simularDto);
  }

  @Get('formulario/:formularioId')
  findByFormulario(@Param('formularioId') formularioId: string) {
    return this.rangosService.findByFormulario(formularioId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rangosService.remove(id);
  }
}