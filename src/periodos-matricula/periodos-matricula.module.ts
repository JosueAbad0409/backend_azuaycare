import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodoMatricula } from './entities/periodos-matricula.entity';
import { PeriodosMatriculaController } from './periodos-matricula.controller';
import { PeriodosMatriculaService } from './periodos-matricula.service';

@Module({
  imports: [TypeOrmModule.forFeature([PeriodoMatricula])],
  controllers: [PeriodosMatriculaController],
  providers: [PeriodosMatriculaService],
  exports: [TypeOrmModule, PeriodosMatriculaService],
})
export class PeriodosMatriculaModule {}