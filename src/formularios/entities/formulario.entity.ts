import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'formularios' })
export class Formulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'character varying', length: 50, default: 'GENERAL' })
  tipo: string;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  publicado: boolean;

  @Column({ type: 'timestamp', nullable: true })
  fecha_publicacion: Date | null;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  // Uniones/Relaciones Físicas
  @ManyToOne(() => PeriodoMatricula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;
}