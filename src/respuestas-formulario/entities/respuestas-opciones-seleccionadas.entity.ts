import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { RespuestasFormulario } from './respuestas-formulario.entity';
import { OpcionPregunta } from '../../opciones-pregunta/entities/opciones-pregunta.entity';

@Entity({ name: 'respuestas_opciones_seleccionadas' })
@Index('IDX_OPCION_SELECCIONADA_RESPUESTA', ['respuesta_id'])
@Index('IDX_OPCION_SELECCIONADA_OPCION', ['opcion_id'])
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