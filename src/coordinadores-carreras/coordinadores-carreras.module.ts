import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoordinadoresCarrera } from './entities/coordinadores-carrera.entity';
import { CoordinadoresCarrerasController } from './coordinadores-carreras.controller';
import { CoordinadoresCarrerasService } from './coordinadores-carreras.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoordinadoresCarrera])],
  controllers: [CoordinadoresCarrerasController],
  providers: [CoordinadoresCarrerasService],
  exports: [TypeOrmModule, CoordinadoresCarrerasService],
})
export class CoordinadoresCarrerasModule {}