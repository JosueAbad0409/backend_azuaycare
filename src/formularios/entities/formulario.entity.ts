import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { TipoFormulario } from 'src/tipos-formulario/entities/tipo-formulario.entity';

@Entity({ name: 'formularios' })
export class Formulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  // ✅ CORREGIDO: Se cambia nullable: true para evitar el error con registros existentes
  @Column({ name: 'tipo_formulario_id', type: 'uuid', nullable: true })
  tipo_formulario_id: string | null;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ name: 'periodo_origen_id', type: 'uuid', nullable: true })
  periodo_origen_id: string | null;

  @Column({ name: 'dias_plazo_modificacion', type: 'integer', nullable: true })
  dias_plazo_modificacion: number | null;

  @Column({ type: 'integer', nullable: false, default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  publicado: boolean;

  @Column({ type: 'boolean', default: false })
  bloqueado: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_bloqueo: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_publicacion: Date | null;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_desactivacion: Date | null;

  // Uniones/Relaciones Físicas
  @ManyToOne(() => PeriodoMatricula, (periodo) => periodo.formularios, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  // ✅ CORREGIDO: Se agrega nullable: true en la relación
  @ManyToOne(() => TipoFormulario, (tipo) => tipo.formularios, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'tipo_formulario_id' })
  tipoFormulario: TipoFormulario;

  @ManyToOne(() => Formulario, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'periodo_origen_id' })
  formularioOrigen: Formulario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @OneToMany(() => Seccion, (seccion) => seccion.formulario)
  secciones: Seccion[];

  @OneToMany(() => FichaRespondida, (ficha) => ficha.formulario)
  fichas_respondidas: FichaRespondida[];
}