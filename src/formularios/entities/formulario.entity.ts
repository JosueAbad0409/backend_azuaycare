import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';

@Entity({ name: 'formularios' })
export class Formulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // NUEVAS COLUMNAS AÑADIDAS
  @Column({ type: 'varchar', length: 255, nullable: false })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: false, default: 'GENERAL' })
  tipo: string;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ type: 'integer', nullable: false, default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  publicado: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_publicacion: Date | null;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por: string | null;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_desactivacion: Date | null;

  // Uniones/Relaciones Físicas
  @ManyToOne(() => PeriodoMatricula, (periodo) => periodo.formularios, {onDelete: 'NO ACTION',})
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @OneToMany(() => Seccion, (seccion) => seccion.formulario)
  secciones: Seccion[];

  @OneToMany(() => FichaRespondida, (ficha) => ficha.formulario)
  fichas_respondidas: FichaRespondida[];
}