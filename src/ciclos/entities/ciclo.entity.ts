import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';

@Entity({ name: 'ciclos' })
export class Ciclo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({type: 'varchar',nullable: false, length: 50 })
  nombre: string;

  @Column({ type: 'int', nullable: false, default: 1 })
  orden: number;

  @Column({ name: 'carrera_id', type: 'uuid', nullable: false })
  carrera_id: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  // Relación física con Carreras

  @ManyToOne(() => Carrera, (carrera) => carrera.ciclos, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'carrera_id' })
  carrera: Carrera;

}