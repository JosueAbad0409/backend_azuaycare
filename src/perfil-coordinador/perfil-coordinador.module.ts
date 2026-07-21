import { Module } from '@nestjs/common';
import { PerfilCoordinadorService } from './perfil-coordinador.service';
import { PerfilCoordinadorController } from './perfil-coordinador.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerfilCoordinador } from './entities/perfil-coordinador.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PerfilCoordinador])],
  controllers: [PerfilCoordinadorController],
  providers: [PerfilCoordinadorService],
})
export class PerfilCoordinadorModule {}
