import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OpcionPregunta } from './entities/opciones-pregunta.entity';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity'; // 👈 IMPORTANTE
import { Formulario } from '../formularios/entities/formulario.entity'; // 👈 IMPORTANTE

import { OpcionesPreguntaController } from './opciones-pregunta.controller';
import { OpcionesPreguntaService } from './opciones-pregunta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OpcionPregunta,
      Pregunta,
      Seccion, // 👈 AGREGADO: Resuelve "Nest can't resolve dependencies" en SeccionRepository
      Formulario, // 👈 AGREGADO: Para evitar que falle FormularioRepository
    ]),
  ],
  controllers: [OpcionesPreguntaController],
  providers: [OpcionesPreguntaService],
  exports: [TypeOrmModule, OpcionesPreguntaService],
})
export class OpcionesPreguntaModule {}