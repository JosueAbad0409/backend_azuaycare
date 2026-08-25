import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OpcionPregunta } from './entities/opciones-pregunta.entity';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

import { OpcionesPreguntaController } from './opciones-pregunta.controller';
import { OpcionesPreguntaService } from './opciones-pregunta.service';
import { FormularioCacheService } from '../common/cache/formulario-cache.service'; // 👈 AGREGADO

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OpcionPregunta,
      Pregunta,
      Seccion,
      Formulario,
    ]),
  ],
  controllers: [OpcionesPreguntaController],
  providers: [
    OpcionesPreguntaService,
    FormularioCacheService, // 👈 AGREGADO: Resuelve la inyección en OpcionesPreguntaService
  ],
  exports: [TypeOrmModule, OpcionesPreguntaService],
})
export class OpcionesPreguntaModule {}