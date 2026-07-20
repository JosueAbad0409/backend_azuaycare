import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Formulario } from '../../formularios/entities/formulario.entity';

@Entity({ name: 'fichas_respondidas' })
export class FichaRespondida {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ name: 'formulario_id', type: 'uuid', nullable: false })
  formulario_id: string;

  @Column({ 
    name: 'total_ingresos', 
    type: 'numeric', 
    default: 0, 
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0
    }
  })
  total_ingresos: number;

  @Column({ 
    name: 'total_egresos', 
    type: 'numeric', 
    default: 0, 
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0
    }
  })
  total_egresos: number;

  // RENDIMIENTO: Sincronización exacta con la columna calculada de Postgres sin sobrecargar firmas de tipo
  @Column({ 
    name: 'balance_final', 
    type: 'numeric', 
    insert: false, 
    update: false, 
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0
    }
  })
  balance_final: number;

  @Column({ name: 'nivel_economico_id', type: 'uuid', nullable: true })
  nivel_economico_id: string | null;

  @Column({ name: 'estado_ficha', type: 'character varying', length: 30, default: 'BORRADOR' })
  estado_ficha: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  // Relaciones Físicas
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => PeriodoMatricula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Formulario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;
}