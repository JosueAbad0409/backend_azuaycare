import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CicloCarrera } from './ciclo-carrera.entity';

@Entity({ name: 'ciclos' })
export class Ciclo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false, length: 50 })
  nombre: string;

  @Column({ type: 'int', nullable: false, default: 1 })
  orden: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  // Relación muchos-a-muchos con Carreras a través de ciclos_carreras
  // (un ciclo puede pertenecer a varias carreras y una carrera puede tener varios ciclos)
  @OneToMany(() => CicloCarrera, (cicloCarrera) => cicloCarrera.ciclo)
  ciclosCarreras: CicloCarrera[];
}
