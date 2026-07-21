import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { Formulario } from 'src/formularios/entities/formulario.entity';
import { NivelesEconomico } from 'src/niveles-economicos/entities/niveles-economico.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'periodos_matricula' })
export class PeriodoMatricula {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false, length: 100, })
  nombre: string;

  @Column({ type: 'date', nullable: false })
  fecha_inicio: Date;

  @Column({ type: 'date', nullable: false })
  fecha_fin: Date;

  @Column({ type: 'boolean', default: false })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @OneToMany(() => Formulario, (formulario) => formulario.periodo)
  formularios: Formulario[];

  @OneToMany(() => NivelesEconomico, (nivel) => nivel.periodo)
  niveles_economicos: NivelesEconomico[];

  @OneToMany(() => FichaRespondida, (ficha) => ficha.periodo)
  fichas_respondidas: FichaRespondida[];

}