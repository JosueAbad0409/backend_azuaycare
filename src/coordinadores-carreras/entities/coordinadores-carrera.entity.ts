import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { UpdateAuditoriaDto } from 'src/auditoria/dto/update-auditoria.dto';

@Entity({ name: 'coordinaciones_carrera' })
export class CoordinadoresCarrera {

  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ name: 'carrera_id', type: 'uuid', nullable: false })
  carrera_id: string;

  @Column({name: 'fecha_inicio', type: 'date', default: () => 'CURRENT_DATE' ,nullable: false})
  fecha_inicio: Date;

  @Column({name: 'fecha_fin', type: 'date', nullable: true})
  fecha_fin: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;


  @ManyToOne(() => Usuario, (usuario) => usuario.coordinaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Carrera, (carrera) => carrera.coordinaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carrera_id' })
  carrera: Carrera;
}