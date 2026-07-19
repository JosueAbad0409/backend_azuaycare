import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Formulario } from '../../formularios/entities/formulario.entity';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';
import { OpcionPregunta } from '../../opciones-pregunta/entities/opciones-pregunta.entity';

@Entity({ name: 'respuestas_formulario' })
export class RespuestasFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'formulario_id', type: 'uuid', nullable: false })
  formulario_id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ name: 'opcion_id', type: 'uuid', nullable: true })
  opcion_id: string | null;

  @Column({ type: 'text', nullable: true })
  texto_respuesta: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // Relaciones Físicas
  @ManyToOne(() => Formulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Pregunta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;

  @ManyToOne(() => OpcionPregunta, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'opcion_id' })
  opcion: OpcionPregunta | null;
}