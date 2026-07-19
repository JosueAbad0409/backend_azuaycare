import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ciclo } from './entities/ciclo.entity';
import { Carrera } from '../carreras/entities/carrera.entity'; 
import { CiclosController } from './ciclos.controller';
import { CiclosService } from './ciclos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ciclo, Carrera])], 
  controllers: [CiclosController],
  providers: [CiclosService],
  exports: [TypeOrmModule, CiclosService],
})
export class CiclosModule {}
