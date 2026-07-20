import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreguntaDependencia } from './entities/pregunta-dependencia.entity';
import { PreguntasDependenciasController } from './preguntas-dependencias.controller';
import { PreguntasDependenciasService } from './preguntas-dependencias.service';

@Module({
  imports: [TypeOrmModule.forFeature([PreguntaDependencia])],
  controllers: [PreguntasDependenciasController],
  providers: [PreguntasDependenciasService],
  exports: [TypeOrmModule, PreguntasDependenciasService],
})
export class PreguntasDependenciasModule {}