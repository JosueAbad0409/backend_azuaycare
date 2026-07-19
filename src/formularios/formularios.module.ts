import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Formulario } from './entities/formulario.entity';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FormulariosController } from './formularios.controller';
import { FormulariosService } from './formularios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Formulario, PeriodoMatricula, Usuario])], 
  controllers: [FormulariosController],
  providers: [FormulariosService],
  exports: [TypeOrmModule, FormulariosService],
})
export class FormulariosModule {}