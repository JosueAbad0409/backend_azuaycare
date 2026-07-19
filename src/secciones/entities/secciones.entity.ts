import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Formulario } from '../../formularios/entities/formulario.entity';

@Entity({ name: 'secciones' })
export class Seccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'formulario_id', type: 'uuid', nullable: false })
  formulario_id: string;

  @Column({ nullable: false, length: 200 })
  nombre: string;

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

  // Relación física con Formularios (Borrados en cascada automáticos)
  @ManyToOne(() => Formulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;
}