import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PeriodoMatricula } from '../../periodos-matricula/entities/periodos-matricula.entity';
import { Formulario } from '../../formularios/entities/formulario.entity';
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';
import { RangoVariableCalculada } from 'src/rangos-variable-calculada/entities/rangos-variable-calculada.entity';

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

  @Column({ 
    name: 'balance_final', 
    type: 'numeric', 
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0
    }
  })
  balance_final: number;

  @Column({ name: 'rango_resultado_id', type: 'uuid', nullable: true })
  rango_resultado_id: string | null;

  @Column({ name: 'estado_ficha', type: 'character varying', length: 30, default: 'BORRADOR' })
  estado_ficha: string;

  @Column({ name: 'fecha_limite_edicion', type: 'timestamp with time zone', nullable: true })
  fecha_limite_edicion: Date | null;

  @Column({ name: 'precargada_de_ficha_id', type: 'uuid', nullable: true })
  precargada_de_ficha_id: string | null;

  @Column({ name: 'cerrado_manual_por', type: 'uuid', nullable: true })
  cerrado_manual_por: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.fichasRespondidas, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => PeriodoMatricula, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Formulario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;

  @ManyToOne(() => RangoVariableCalculada, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'rango_resultado_id' })
  rangoResultado: RangoVariableCalculada;

  @ManyToOne(() => FichaRespondida, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'precargada_de_ficha_id' })
  fichaOrigenPrecarga: FichaRespondida;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'cerrado_manual_por' })
  cerradoPorUsuario: Usuario;

  @OneToMany(() => RespuestasFormulario, (respuesta) => respuesta.ficha)
  respuestas: RespuestasFormulario[];
}