import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RespuestasMatriz } from './entities/respuestas-matriz.entity';
import { RespuestasMatrizController } from './respuestas-matriz.controller';
import { RespuestasMatrizService } from './respuestas-matriz.service';

@Module({
  imports: [TypeOrmModule.forFeature([RespuestasMatriz])],
  controllers: [RespuestasMatrizController],
  providers: [RespuestasMatrizService],
  exports: [TypeOrmModule, RespuestasMatrizService],
})
export class RespuestasMatrizModule {}