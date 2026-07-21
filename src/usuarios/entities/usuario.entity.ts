import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  JoinColumn, 
  ManyToOne, 
  OneToMany, 
  OneToOne, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn 
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Carrera } from 'src/carreras/entities/carrera.entity';
import { CoordinadoresCarrera } from 'src/coordinadores-carreras/entities/coordinadores-carrera.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { PerfilCoordinador } from 'src/perfil-coordinador/entities/perfil-coordinador.entity';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_id', unique: true, nullable: false })
  google_id: string;

  @Column({ name: 'email_institucional', type: 'varchar', length: 150, unique: true, nullable: true })
  email_institucional: string | null;

  @Column({ name: 'email_personal', type: 'varchar', length: 150, unique: true, nullable: true })
  email_personal: string | null;

  @Column({ name: 'primer_nombre', type: 'varchar', length: 100, nullable: false })
  primer_nombre: string;

  @Column({ name: 'segundo_nombre', type: 'varchar', length: 100, nullable: true })
  segundo_nombre: string | null;

  @Column({ name: 'primer_apellido', type: 'varchar', length: 100, nullable: false })
  primer_apellido: string;

  @Column({ name: 'segundo_apellido', type: 'varchar', length: 100, nullable: true })
  segundo_apellido: string | null;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  cedula: string | null;

  @Column({ name: 'rol_id', type: 'uuid', nullable: false })
  rol_id: string;

  @Column({ name: 'carrera_id', type: 'uuid', nullable: true })
  carrera_id: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => Role, (role) => role.usuarios, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rol_id' })
  rol: Role;

  @ManyToOne(() => Carrera, (carrera) => carrera.usuarios, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_id' })
  carrera: Carrera | null;

  @OneToMany(() => CoordinadoresCarrera, (coordinacion) => coordinacion.usuario)
  coordinaciones: CoordinadoresCarrera[];


  @OneToOne(() => PerfilCoordinador, (perfil) => perfil.usuario)
  perfilCoordinador: PerfilCoordinador;

  @OneToMany(()=> FichaRespondida, (ficha) => ficha.usuario)
  fichasRespondidas: FichaRespondida[];


}