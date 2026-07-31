import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entidades necesarias
import { PreguntaDependencia } from './entities/pregunta-dependencia.entity';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

import { PreguntasDependenciasController } from './preguntas-dependencias.controller';
import { PreguntasDependenciasService } from './preguntas-dependencias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreguntaDependencia,
      Pregunta,   // 👈 Agregado para resolver el repositorio en el índice [1]
      Seccion,    // 👈 Agregado para prevenir errores de SeccionRepository
      Formulario, // 👈 Agregado para prevenir errores de FormularioRepository
    ]),
  ],
  controllers: [PreguntasDependenciasController],
  providers: [PreguntasDependenciasService],
  exports: [TypeOrmModule, PreguntasDependenciasService],
})
export class PreguntasDependenciasModule {}