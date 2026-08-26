import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Provincia } from './provincia.entity';

@Entity({ name: 'cantones' })
export class Canton {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'provincia_id', type: 'uuid' })
  provincia_id: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @ManyToOne(() => Provincia, (provincia) => provincia.cantones, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'provincia_id' })
  provincia: Provincia;
}