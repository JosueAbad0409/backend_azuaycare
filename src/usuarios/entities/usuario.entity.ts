import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  JoinColumn, 
  ManyToOne, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn 
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_id', unique: true, nullable: false })
  google_id: string;

  @Column({ name: 'email_institucional', unique: true, nullable: false })
  email_institucional: string;

  @Column({ name: 'primer_nombre', nullable: false })
  primer_nombre: string;

  @Column({ name: 'primer_apellido', nullable: false })
  primer_apellido: string;

  @Column({ name: 'segundo_nombre', nullable: true })
  segundo_nombre?: string;

  @Column({ name: 'segundo_apellido', nullable: true })
  segundo_apellido?: string;

  @Column({ unique: true, nullable: true })
  cedula?: string;

  // RENDIMIENTO: Columna física de FK para escrituras rápidas sin consultas de relación
  @Column({ name: 'rol_id', type: 'uuid' })
  rol_id: string;

  @Column({ name: 'carrera_id', type: 'uuid', nullable: true })
  carrera_id?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => Role, (role) => role.usuarios, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rol_id' })
  rol: Role;
}