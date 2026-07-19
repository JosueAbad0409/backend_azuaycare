import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';

@Entity({ name: 'opciones_pregunta' })
export class OpcionPregunta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ type: 'text', nullable: false })
  texto_opcion: string;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por: string | null;

  @Column({ name: 'actualizado_por', type: 'uuid', nullable: true })
  actualizado_por: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  // Relación física con Preguntas (Si se borra la pregunta, se limpian sus opciones)
  @ManyToOne(() => Pregunta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;
}