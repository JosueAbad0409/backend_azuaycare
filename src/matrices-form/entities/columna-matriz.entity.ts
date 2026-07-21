import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';

@Entity({ name: 'columnas_matriz' })
export class ColumnaMatriz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ name: 'texto_columna', type: 'character varying', length: 255, nullable: false })
  texto_columna: string;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'timestamp', name: 'fecha_desactivacion', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => Pregunta, (pregunta) => pregunta.columnas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;
}