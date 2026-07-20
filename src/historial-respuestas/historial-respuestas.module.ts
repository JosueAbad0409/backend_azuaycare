import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialRespuesta } from './entities/historial-respuesta.entity';
import { HistorialRespuestasController } from './historial-respuestas.controller';
import { HistorialRespuestasService } from './historial-respuestas.service';

@Module({
  imports: [TypeOrmModule.forFeature([HistorialRespuesta])],
  controllers: [HistorialRespuestasController],
  providers: [HistorialRespuestasService],
  exports: [TypeOrmModule, HistorialRespuestasService],
})
export class HistorialRespuestasModule {}