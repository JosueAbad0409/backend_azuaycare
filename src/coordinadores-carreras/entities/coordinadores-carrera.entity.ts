import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Carrera } from '../../carreras/entities/carrera.entity';

@Entity({ name: 'coordinadores_carreras' })
export class CoordinadoresCarrera {
  @PrimaryColumn({ name: 'usuario_id', type: 'uuid' })
  usuario_id: string;

  @PrimaryColumn({ name: 'carrera_id', type: 'uuid' })
  carrera_id: string;

  @CreateDateColumn({ type: 'timestamp', name: 'fecha_asignacion', default: () => 'CURRENT_TIMESTAMP' })
  fecha_asignacion: Date;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Carrera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id' })
  carrera: Carrera;
}