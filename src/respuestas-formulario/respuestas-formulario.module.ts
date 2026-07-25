import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { RespuestaOpcionSeleccionada } from './entities/respuestas-opciones-seleccionadas.entity'; 
import { RespuestasFormularioController } from './respuestas-formulario.controller';
import { RespuestasFormularioService } from './respuestas-formulario.service';
import { DocumentosRespaldoModule } from 'src/documentos-respaldo/documentos-respaldo.module';

@Module({
  imports: [TypeOrmModule.forFeature([RespuestasFormulario, RespuestaOpcionSeleccionada]),
  DocumentosRespaldoModule,
],

  controllers: [RespuestasFormularioController],
  providers: [RespuestasFormularioService],
  exports: [TypeOrmModule, RespuestasFormularioService],
})
export class RespuestasFormularioModule {}