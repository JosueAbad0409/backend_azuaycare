import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FichaRespondida } from '../../fichas-respondidas/entities/ficha-respondida.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'historial_estados_ficha' })
export class HistorialEstadosFicha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ficha_id', type: 'uuid', nullable: false })
  ficha_id: string;

  @Column({ name: 'estado_anterior', type: 'varchar', length: 30, nullable: true })
  estado_anterior: string | null;

  @Column({ name: 'estado_nuevo', type: 'varchar', length: 30, nullable: false })
  estado_nuevo: string;

  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  @Column({ name: 'cambiado_por', type: 'uuid', nullable: true })
  cambiado_por: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Relaciones

  @ManyToOne(() => FichaRespondida, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ficha_id' })
  ficha: FichaRespondida;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}