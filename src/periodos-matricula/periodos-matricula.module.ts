import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodoMatricula } from './entities/periodos-matricula.entity';
import { PeriodosMatriculaController } from './periodos-matricula.controller';
import { PeriodosMatriculaService } from './periodos-matricula.service';
import { FormulariosModule } from 'src/formularios/formularios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PeriodoMatricula]),
    forwardRef(() => FormulariosModule),
  ],
  controllers: [PeriodosMatriculaController],
  providers: [PeriodosMatriculaService],
  exports: [TypeOrmModule, PeriodosMatriculaService],
})
export class PeriodosMatriculaModule {}