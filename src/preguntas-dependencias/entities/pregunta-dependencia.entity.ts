import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';
import { OpcionPregunta } from '../../opciones-pregunta/entities/opciones-pregunta.entity';

@Entity({ name: 'preguntas_dependencias' })
export class PreguntaDependencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ name: 'pregunta_disparadora_id', type: 'uuid', nullable: false })
  pregunta_disparadora_id: string;

  @Column({ name: 'opcion_disparadora_id', type: 'uuid', nullable: true })
  opcion_disparadora_id: string | null;

  @Column({ name: 'valor_disparador', type: 'character varying', length: 255, nullable: true })
  valor_disparador: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'timestamp', name: 'fecha_desactivacion', nullable: true })
  fecha_desactivacion: Date | null;

  // Relaciones físicas
  @ManyToOne(() => Pregunta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;

  @ManyToOne(() => Pregunta, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pregunta_disparadora_id' })
  preguntaDisparadora: Pregunta;

  @ManyToOne(() => OpcionPregunta, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opcion_disparadora_id' })
  opcionDisparadora: OpcionPregunta;
}