import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seccion } from './entities/secciones.entity'; // 👈 Ruta adaptada al plural
import { Formulario } from '../formularios/entities/formulario.entity';
import { SeccionesController } from './secciones.controller';
import { SeccionesService } from './secciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Seccion, Formulario])],
  controllers: [SeccionesController],
  providers: [SeccionesService],
  exports: [TypeOrmModule, SeccionesService],
})
export class SeccionesModule {}