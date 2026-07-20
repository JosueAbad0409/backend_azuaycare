import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RespuestasFormulario } from '../../respuestas-formulario/entities/respuestas-formulario.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'historial_respuestas' })
export class HistorialRespuesta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'respuesta_id', type: 'uuid', nullable: false })
  respuesta_id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ type: 'text', nullable: true })
  valor_texto_anterior: string | null;

  @Column({ type: 'numeric', nullable: true })
  valor_numerico_anterior: number | null;

  @Column({ type: 'text', nullable: true })
  valor_texto_nuevo: string | null;

  @Column({ type: 'numeric', nullable: true })
  valor_numerico_nuevo: number | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => RespuestasFormulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}