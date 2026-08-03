import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RespuestasFormulario } from '../../respuestas-formulario/entities/respuestas-formulario.entity';
import { FichaRespondida } from '../../fichas-respondidas/entities/ficha-respondida.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'documentos_respaldo' })
export class DocumentoRespaldo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // NUEVO: Para enlazar el documento al usuario que lo sube siempre
  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  // Opcional: solo se llena cuando el documento respalda una pregunta puntual
  @Column({ name: 'respuesta_id', type: 'uuid', nullable: true })
  respuesta_id: string | null;

  // Opcional: se llena cuando el documento es general de la ficha
  @Column({ name: 'ficha_id', type: 'uuid', nullable: true })
  ficha_id: string | null;

  @Column({ name: 'ruta_archivo', type: 'text', nullable: false })
  ruta_archivo: string;

  @Column({ name: 'nombre_original', type: 'character varying', length: 255, nullable: false })
  nombre_original: string;

  @Column({ name: 'mime_type', type: 'character varying', length: 100, nullable: false })
  mime_type: string;

  @Column({ name: 'tamanio_bytes', type: 'integer', nullable: false })
  tamanio_bytes: number;

  // MODIFICADO: Ahora por defecto es null en lugar de false
  @Column({ name: 'verificado', type: 'boolean', nullable: true, default: null })
  verificado: boolean | null;

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

  // Relaciones
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => RespuestasFormulario, (respuesta) => respuesta.documentos, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario | null;

  @ManyToOne(() => FichaRespondida, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'ficha_id' })
  ficha: FichaRespondida | null;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_verificador' })
  verificador: Usuario;
}