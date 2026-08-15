import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerfilCoordinadorService } from './perfil-coordinador.service';
import { PerfilCoordinadorController } from './perfil-coordinador.controller';
import { PerfilCoordinador } from './entities/perfil-coordinador.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CoordinadoresCarrera } from '../coordinadores-carreras/entities/coordinadores-carrera.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PerfilCoordinador,
      Usuario,
      CoordinadoresCarrera,
    ]),
  ],
  controllers: [PerfilCoordinadorController],
  providers: [PerfilCoordinadorService],
  exports: [PerfilCoordinadorService],
})
export class PerfilCoordinadorModule {}