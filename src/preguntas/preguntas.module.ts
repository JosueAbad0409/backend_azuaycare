import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pregunta } from './entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { TipoCampoForm } from '../tipos-campo-form/entities/tipos-campo-form.entity';
import { PreguntasController } from './preguntas.controller';
import { PreguntasService } from './preguntas.service';
import { Formulario } from 'src/formularios/entities/formulario.entity';
import { FormularioCacheModule } from 'src/common/cache/formulario-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pregunta, Seccion, TipoCampoForm, Formulario]),
    FormularioCacheModule,
  ],
  controllers: [PreguntasController],
  providers: [PreguntasService],
  exports: [TypeOrmModule, PreguntasService],
})
export class PreguntasModule {}