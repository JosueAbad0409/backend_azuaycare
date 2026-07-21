import { Ciclo } from 'src/ciclos/entities/ciclo.entity';
import { CoordinadoresCarrera } from 'src/coordinadores-carreras/entities/coordinadores-carrera.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'carreras' })
export class Carrera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: false, length: 150 })
  nombre: string;

  @Column({ name: 'correo_institucional',unique: true, type: 'varchar', nullable: false, length: 150})
  coreo_institucional: string;


  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;


  // Relaciones hacia las tablas

  // Relacion con usuarios (usuarios.carrera_id)
  @OneToMany(() => Usuario, (usuario) => usuario.carrera_id)
  usuarios: Usuario[];

  // Relación con coordinaciones_carrera
  @OneToMany(() => CoordinadoresCarrera, (coordinacion) => coordinacion.carrera)
  coordinaciones: CoordinadoresCarrera[];

  // Relación con ciclos
  @OneToMany(() => Ciclo, (ciclo) => ciclo.carrera)
  ciclos: Ciclo[];


}