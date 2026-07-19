import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Seccion } from '../../secciones/entities/secciones.entity';
import { TipoCampoForm } from '../../tipos-campo-form/entities/tipos-campo-form.entity';

@Entity({ name: 'preguntas' })
export class Pregunta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seccion_id', type: 'uuid', nullable: false })
  seccion_id: string;

  @Column({ type: 'text', nullable: false })
  enunciado: string;

  @Column({ name: 'tipo_campo_id', type: 'uuid', nullable: false })
  tipo_campo_id: string;

  @Column({ name: 'categoria_financiera', type: 'character varying', length: 50, default: 'NINGUNO' })
  categoria_financiera: string;

  @Column({ name: 'es_obligatorio', type: 'boolean', default: true })
  obligatorio: boolean;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'codigo_sistema', type: 'character varying', length: 50, nullable: true })
  codigo_sistema: string | null;

  @Column({ name: 'requiere_evidencia', type: 'boolean', default: false })
  requiere_evidencia: boolean;

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

  @ManyToOne(() => Seccion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seccion_id' })
  seccion: Seccion;

  @ManyToOne(() => TipoCampoForm, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipo_campo_id' })
  tipoCampo: TipoCampoForm;
}