import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { TipoFormulario } from 'src/tipos-formulario/entities/tipo-formulario.entity'; // NUEVO IMPORT

@Entity({ name: 'formularios' })
export class Formulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  // ❌ ELIMINADO: @Column({ type: 'varchar', length: 50, default: 'GENERAL' }) tipo: string;

  // ✅ NUEVO: reemplaza al campo "tipo" quemado por una relación real.
  @Column({ name: 'tipo_formulario_id', type: 'uuid', nullable: false })
  tipo_formulario_id: string;

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

  // ✅ NUEVO: marca esta versión como versión "anterior" de solo lectura,
  // producto de haber sido clonada hacia un nuevo periodo.
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

  // ✅ NUEVO
  @ManyToOne(() => TipoFormulario, (tipo) => tipo.formularios, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'tipo_formulario_id' })
  tipoFormulario: TipoFormulario;

  // ⚠️ CAMBIO CRÍTICO: de 'NO ACTION' a 'SET NULL'.
  // Cuando se purgue (DELETE físico) la versión más antigua de un tipo de formulario,
  // la versión que la sucede (que sigue viva) todavía apunta a ella vía periodo_origen_id.
  // Con 'NO ACTION' el DELETE fallaría por violación de llave foránea.
  // Con 'SET NULL' Postgres limpia automáticamente esa referencia y el DELETE se completa.
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