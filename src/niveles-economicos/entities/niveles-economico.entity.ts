import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';

@Entity({ name: 'niveles_economicos' })
export class NivelesEconomico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'character varying', length: 100, nullable: false })
  nombre: string;

  @Column({ 
    name: 'valor_min', 
    type: 'numeric', 
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0
    }
  })
  valor_min: number;

  @Column({ 
    name: 'valor_max', 
    type: 'numeric', 
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => value ? parseFloat(value) : null
    }
  })
  valor_max: number | null;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: true })
  periodo_id: string | null;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por: string | null;

  @Column({ name: 'actualizado_por', type: 'uuid', nullable: true })
  actualizado_por: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => PeriodoMatricula, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @OneToMany (() => FichaRespondida, (ficha) => ficha.nivel_economico_id)
  fichas_respondidas: FichaRespondida[];

}