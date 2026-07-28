import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';
import { Formulario } from '../../formularios/entities/formulario.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Pregunta } from 'src/preguntas/entities/pregunta.entity';

@Entity({ name: 'secciones' })
@Index('IDX_SECCION_FORMULARIO_ID', ['formulario_id'])
export class Seccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'formulario_id', type: 'uuid', nullable: false })
  formulario_id: string;

  @Column({ nullable: false, length: 200 })
  nombre: string;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'tipo_seccion', type: 'varchar', length: 50, default: 'INFORMACION_GENERAL' })
  tipo_seccion: string;

  @Column({ name: 'subcategoria_financiera', type: 'varchar', length: 50, default: 'NINGUNO' })
  subcategoria_financiera: string;

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

  // Relación física con Formularios
  @ManyToOne(() => Formulario, (formulario) => formulario.secciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'actualizado_por' })
  actualizador: Usuario;

  @OneToMany(() => Pregunta, (pregunta) => pregunta.seccion)
  preguntas: Pregunta[];
}