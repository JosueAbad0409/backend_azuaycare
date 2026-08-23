import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Ciclo } from './ciclo.entity';
import { Carrera } from '../../carreras/entities/carrera.entity';

@Entity({ name: 'ciclos_carreras' })
export class CicloCarrera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ciclo_id', type: 'uuid', nullable: false })
  ciclo_id: string;

  @Column({ name: 'carrera_id', type: 'uuid', nullable: false })
  carrera_id: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Ciclo, (ciclo) => ciclo.ciclosCarreras, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ciclo_id' })
  ciclo: Ciclo;

  @ManyToOne(() => Carrera, (carrera) => carrera.ciclosCarreras, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id' })
  carrera: Carrera;
}
