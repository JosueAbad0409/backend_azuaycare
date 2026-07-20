import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RespuestasFormulario } from '../../respuestas-formulario/entities/respuestas-formulario.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'documentos_respaldo' })
export class DocumentoRespaldo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'respuesta_id', type: 'uuid', nullable: false })
  respuesta_id: string;

  @Column({ name: 'ruta_archivo', type: 'text', nullable: false })
  ruta_archivo: string;

  @Column({ name: 'nombre_original', type: 'character varying', length: 255, nullable: false })
  nombre_original: string;

  @Column({ name: 'mime_type', type: 'character varying', length: 100, nullable: false })
  mime_type: string;

  @Column({ name: 'tamanio_bytes', type: 'integer', nullable: false })
  tamanio_bytes: number;

  @Column({ name: 'verificado', type: 'boolean', default: false })
  verificado: boolean;

  @Column({ name: 'fecha_verificacion', type: 'timestamp', nullable: true })
  fecha_verificacion: Date | null;

  @Column({ name: 'usuario_verificador', type: 'uuid', nullable: true })
  usuario_verificador: string | null;

  @Column({ name: 'observacion', type: 'text', nullable: true })
  observacion: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'timestamp', name: 'fecha_desactivacion', nullable: true })
  fecha_desactivacion: Date | null;

  @ManyToOne(() => RespuestasFormulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_verificador' })
  verificador: Usuario;
}