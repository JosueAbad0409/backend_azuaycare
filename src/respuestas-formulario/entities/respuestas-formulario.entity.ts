import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { FichaRespondida } from '../../fichas-respondidas/entities/ficha-respondida.entity';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';

@Entity({ name: 'respuestas' }) 
export class RespuestasFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ficha_id', type: 'uuid', nullable: false })
  ficha_id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ type: 'text', nullable: true })
  valor_texto: string | null;

  @Column({ 
    name: 'valor_numerico', 
    type: 'numeric', 
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => value ? parseFloat(value) : null
    }
  })
  valor_numerico: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => FichaRespondida, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ficha_id' })
  ficha: FichaRespondida;

  @ManyToOne(() => Pregunta, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;
}