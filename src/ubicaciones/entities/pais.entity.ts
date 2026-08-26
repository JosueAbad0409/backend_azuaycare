import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Provincia } from './provincia.entity';


@Entity({ name: 'paises' })
export class Pais {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nacionalidad: string; 

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @OneToMany(() => Provincia, (provincia) => provincia.pais)
  provincias: Provincia[];
}