import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpcionPregunta } from './entities/opciones-pregunta.entity';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { OpcionesPreguntaController } from './opciones-pregunta.controller';
import { OpcionesPreguntaService } from './opciones-pregunta.service';

@Module({
  imports: [TypeOrmModule.forFeature([OpcionPregunta, Pregunta])],
  controllers: [OpcionesPreguntaController],
  providers: [OpcionesPreguntaService],
  exports: [TypeOrmModule, OpcionesPreguntaService],
})
export class OpcionesPreguntaModule {}