import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RespuestasFormulario } from '../../respuestas-formulario/entities/respuestas-formulario.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity({ name: 'historial_respuestas' })
export class HistorialRespuesta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'respuesta_id', type: 'uuid', nullable: false })
  respuesta_id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ type: 'jsonb', nullable: false })
  cambios_realizados: {
    datos_anteriores: {
      valor_texto: string | null;
      valor_numerico: number | null;
    };
    datos_nuevos: {
      valor_texto: string | null;
      valor_numerico: number | null;
    };
  };

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  // Relaciones

  @ManyToOne(() => RespuestasFormulario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'respuesta_id' })
  respuesta: RespuestasFormulario;

  @ManyToOne(() => Usuario, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}