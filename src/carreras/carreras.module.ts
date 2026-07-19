import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrera } from './entities/carrera.entity';
import { CarrerasController } from './carreras.controller';
import { CarrerasService } from './carreras.service';

@Module({
  imports: [TypeOrmModule.forFeature([Carrera])],
  controllers: [CarrerasController],
  providers: [CarrerasService],
  exports: [TypeOrmModule, CarrerasService],
})
export class CarrerasModule {}