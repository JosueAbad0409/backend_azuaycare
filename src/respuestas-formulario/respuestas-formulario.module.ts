import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { RespuestaOpcionSeleccionada } from './entities/respuestas-opciones-seleccionadas.entity'; 
import { RespuestasFormularioController } from './respuestas-formulario.controller';
import { RespuestasFormularioService } from './respuestas-formulario.service';

@Module({
  imports: [TypeOrmModule.forFeature([RespuestasFormulario, RespuestaOpcionSeleccionada])], 
  controllers: [RespuestasFormularioController],
  providers: [RespuestasFormularioService],
  exports: [TypeOrmModule, RespuestasFormularioService],
})
export class RespuestasFormularioModule {}