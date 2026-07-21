import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RespuestasFormulario } from './respuestas-formulario.entity';
import { OpcionPregunta } from '../../opciones-pregunta/entities/opciones-pregunta.entity';

@Entity({ name: 'respuestas_opciones_seleccionadas' })
export class RespuestaOpcionSeleccionada {
  @PrimaryColumn({ type: 'uuid' })
  respuesta_id: string;

  @PrimaryColumn({ type: 'uuid' })
  opcion_id: string;

  @ManyToOne(() => RespuestasFormulario, (respuesta) => respuesta.opcionesSeleccionadas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario;

  @ManyToOne(() => OpcionPregunta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opcion_id' })
  opcion: OpcionPregunta;
}

