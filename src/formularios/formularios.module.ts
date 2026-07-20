import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Formulario } from './entities/formulario.entity';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { UsuariosModule } from '../usuarios/usuarios.module'; // 👈 Módulo importado
import { FormulariosController } from './formularios.controller';
import { FormulariosService } from './formularios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Formulario, PeriodoMatricula]), 
    UsuariosModule // 👈 Reemplaza la inyección directa de la entidad por el módulo exportador
  ], 
  controllers: [FormulariosController],
  providers: [FormulariosService],
  exports: [TypeOrmModule, FormulariosService],
})
export class FormulariosModule {}