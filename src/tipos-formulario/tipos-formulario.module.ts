import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoFormulario } from './entities/tipo-formulario.entity';
import { Formulario } from '../formularios/entities/formulario.entity';
import { TiposFormularioController } from './tipos-formulario.controller';
import { TiposFormularioService } from './tipos-formulario.service';

@Module({
  // Se registra también el repositorio de Formulario porque el service lo necesita
  // para validar que un tipo no tenga formularios activos antes de eliminarlo.
  imports: [TypeOrmModule.forFeature([TipoFormulario, Formulario])],
  controllers: [TiposFormularioController],
  providers: [TiposFormularioService],
  exports: [TypeOrmModule, TiposFormularioService],
})
export class TiposFormularioModule {}