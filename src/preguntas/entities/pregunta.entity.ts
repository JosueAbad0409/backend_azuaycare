import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  JoinColumn, 
  ManyToOne, 
  OneToMany, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';
import { Seccion } from '../../secciones/entities/secciones.entity';
import { TipoCampoForm } from '../../tipos-campo-form/entities/tipos-campo-form.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { OpcionPregunta } from 'src/opciones-pregunta/entities/opciones-pregunta.entity';
import { PreguntaDependencia } from 'src/preguntas-dependencias/entities/pregunta-dependencia.entity';
import { FilaMatriz } from 'src/matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from 'src/matrices-form/entities/columna-matriz.entity';
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';

@Entity({ name: 'preguntas' })
@Index('IDX_PREGUNTA_SECCION_ID', ['seccion_id'])
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

  @Column({ name: 'variable_calculo', type: 'varchar', length: 50, nullable: true })
  variable_calculo: string | null;

  @Column({ name: 'es_obligatorio', type: 'boolean', default: true })
  es_obligatorio: boolean;

  @Column({ type: 'integer', default: 1 })
  orden: number;

  @Column({ name: 'codigo_sistema', type: 'character varying', length: 50, nullable: true })
  codigo_sistema?: string | null;

  @Column({ name: 'requiere_evidencia', type: 'boolean', default: false })
  requiere_evidencia: boolean;

  @Column({ name: 'revision_manual_obligatoria', type: 'boolean', default: false })
  revision_manual_obligatoria: boolean;

  // 🔥 NUEVO CAMPO: Define si en cada fila de la matriz se pueden elegir varias opciones (checkbox) o solo una (radio)
  @Column({ name: 'permitir_multiple_matriz', type: 'boolean', default: false })
  permitir_multiple_matriz: boolean;

  @Column({ name: 'creado_por', type: 'uuid', nullable: true })
  creado_por?: string | null;

  @Column({ name: 'actualizado_por', type: 'uuid', nullable: true })
  actualizado_por?: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'timestamp', name: 'fecha_desactivacion', nullable: true })
  fecha_desactivacion?: Date | null;

  @ManyToOne(() => Seccion, (seccion) => seccion.preguntas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seccion_id' })
  seccion: Seccion;

  @ManyToOne(() => TipoCampoForm, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'tipo_campo_id' })
  tipoCampo: TipoCampoForm;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'actualizado_por' })
  actualizador: Usuario;

  @OneToMany(() => OpcionPregunta, (opcion) => opcion.pregunta)
  opciones: OpcionPregunta[];

  @OneToMany(() => PreguntaDependencia, (dependencia) => dependencia.pregunta)
  dependencias: PreguntaDependencia[];

  @OneToMany(() => PreguntaDependencia, (dependencia) => dependencia.preguntaDisparadora)
  dependenciasDisparadas: PreguntaDependencia[];

  @OneToMany(() => FilaMatriz, (fila) => fila.pregunta)
  filas: FilaMatriz[];

  @OneToMany(() => ColumnaMatriz, (columna) => columna.pregunta)
  columnas: ColumnaMatriz[];

  @OneToMany(() => RespuestasFormulario, (respuesta) => respuesta.pregunta)
  respuestas: RespuestasFormulario[];
}