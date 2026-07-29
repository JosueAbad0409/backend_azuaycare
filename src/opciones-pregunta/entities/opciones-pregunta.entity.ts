import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';
import { Pregunta } from '../../preguntas/entities/pregunta.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';

@Entity({ name: 'opciones_pregunta' })
@Index('IDX_OPCION_PREGUNTA_ID', ['pregunta_id'])
export class OpcionPregunta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pregunta_id', type: 'uuid', nullable: false })
  pregunta_id: string;

  @Column({ type: 'text', nullable: false })
  texto_opcion: string;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'permite_texto_libre', type: 'boolean', default: false })
  permite_texto_libre: boolean;

  @Column ({name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  // 🔥 NUEVOS CAMPOS:
  @Column({ name: 'valor_ponderado', type: 'numeric', default: 0 })
  valor_ponderado: number;

  @Column({ name: 'dispara_dependencia', type: 'boolean', default: false })
  dispara_dependencia: boolean;

  @Column({ name: 'pregunta_hija_id', type: 'uuid', nullable: true })
  pregunta_hija_id: string | null;

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

  @ManyToOne(() => Pregunta, (pregunta) => pregunta.opciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'actualizado_por' })
  actualizador: Usuario;
}