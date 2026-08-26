import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Pais } from './pais.entity';
import { Canton } from './canton.entity';


@Entity({ name: 'provincias' })
export class Provincia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'pais_id', type: 'uuid' })
  pais_id: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @ManyToOne(() => Pais, (pais) => pais.provincias, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pais_id' })
  pais: Pais;

  @OneToMany(() => Canton, (canton) => canton.provincia)
  cantones: Canton[];
}