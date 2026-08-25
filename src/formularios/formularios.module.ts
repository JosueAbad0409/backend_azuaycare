import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormulariosService } from './formularios.service';
import { FormulariosController } from './formularios.controller';
import { Formulario } from './entities/formulario.entity';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { Pregunta } from 'src/preguntas/entities/pregunta.entity';
import { OpcionPregunta } from 'src/opciones-pregunta/entities/opciones-pregunta.entity';
import { FilaMatriz } from 'src/matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from 'src/matrices-form/entities/columna-matriz.entity';
import { PreguntaDependencia } from 'src/preguntas-dependencias/entities/pregunta-dependencia.entity';
import { TipoFormulario } from 'src/tipos-formulario/entities/tipo-formulario.entity';
import { FormularioCacheModule } from 'src/common/cache/formulario-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Formulario,
      PeriodoMatricula,
      Seccion,
      Pregunta,
      OpcionPregunta,
      FilaMatriz,
      ColumnaMatriz,
      PreguntaDependencia,
      TipoFormulario,
    ]),
    FormularioCacheModule,
  ],
  controllers: [FormulariosController],
  providers: [FormulariosService],
  exports: [FormulariosService],
})
export class FormulariosModule {}