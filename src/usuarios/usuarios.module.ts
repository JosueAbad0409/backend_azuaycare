import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { Ciclo } from '../ciclos/entities/ciclo.entity';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { PerfilUsuarioPeriodo } from './entities/perfil-usuario-periodo.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Ciclo, PeriodoMatricula, PerfilUsuarioPeriodo])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [TypeOrmModule, UsuariosService],
})
export class UsuariosModule {}