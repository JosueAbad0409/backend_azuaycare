import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RespuestasFormulario } from '../../respuestas-formulario/entities/respuestas-formulario.entity';
import { FilaMatriz } from '../../matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from '../../matrices-form/entities/columna-matriz.entity';

@Entity({ name: 'respuestas_matriz' })
export class RespuestasMatriz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'respuesta_id', type: 'uuid', nullable: false })
  respuesta_id: string;

  @Column({ name: 'fila_id', type: 'uuid', nullable: false })
  fila_id: string;

  @Column({ name: 'columna_id', type: 'uuid', nullable: false })
  columna_id: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => RespuestasFormulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario;

  @ManyToOne(() => FilaMatriz, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'fila_id' })
  fila: FilaMatriz;

  @ManyToOne(() => ColumnaMatriz, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'columna_id' })
  columna: ColumnaMatriz;
}