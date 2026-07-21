import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'auditoria' })
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuario_id: string | null;

  @Column({ name: 'tabla_afectada', type: 'character varying', length: 100, nullable: false })
  tabla_afectada: string;

  @Column({ name: 'registro_id', type: 'uuid', nullable: false })
  registro_id: string;

  @Column({ name: 'accion', type: 'character varying', length: 50, nullable: false })
  accion: string;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: any;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: any;

  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}