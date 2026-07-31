import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilaMatriz } from './entities/fila-matriz.entity';
import { ColumnaMatriz } from './entities/columna-matriz.entity';
import { Pregunta } from '../preguntas/entities/pregunta.entity'; // 👈 Agregar
import { Seccion } from '../secciones/entities/secciones.entity';   // 👈 Agregar
import { Formulario } from '../formularios/entities/formulario.entity'; // 👈 Agregar
import { MatricesFormService } from './matrices-form.service';
import { MatricesFormController } from './matrices-form.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FilaMatriz,
      ColumnaMatriz,
      Pregunta,   // 👈
      Seccion,    // 👈
      Formulario, // 👈
    ]),
  ],
  controllers: [MatricesFormController],
  providers: [MatricesFormService],
  exports: [TypeOrmModule, MatricesFormService],
})
export class MatricesFormModule {}