import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';
import { Pais } from 'src/ubicaciones/entities/pais.entity';
import { EstadoCivilEnum, EtniaEnum, SexoEnum } from '../enums/perfil-usuario.enum';

@Entity({ name: 'perfiles_usuario_periodo' })
@Index(['usuario_id', 'periodo_id'], { unique: true })
export class PerfilUsuarioPeriodo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ type: 'enum', enum: SexoEnum, nullable: false })
  sexo: SexoEnum;

  @Column({ name: 'esta_embarazada', type: 'boolean', nullable: true })
  esta_embarazada: boolean | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  genero: string;

  @Column({ name: 'estado_civil', type: 'enum', enum: EstadoCivilEnum, nullable: false })
  estado_civil: EstadoCivilEnum;

  @Column({ name: 'tiene_hijos', type: 'boolean', nullable: false })
  tiene_hijos: boolean;

  @Column({ name: 'hijos_menores_5_anios', type: 'int', nullable: true })
  hijos_menores_5_anios: number | null;

  @Column({ type: 'enum', enum: EtniaEnum, nullable: false })
  etnia: EtniaEnum;

  @Column({ name: 'pueblo_nacionalidad', type: 'varchar', length: 150, nullable: true })
  pueblo_nacionalidad: string | null;

  @Column({ name: 'etnia_otra', type: 'varchar', length: 100, nullable: true })
  etnia_otra: string | null;

  @Column({ type: 'varchar', length: 100, nullable: false })
  idioma: string;

  @Column({ name: 'lugar_nacimiento', type: 'varchar', length: 150, nullable: false })
  lugar_nacimiento: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: false })
  fecha_nacimiento: Date;

  @Column({ name: 'nacionalidad_id', type: 'uuid', nullable: false })
  nacionalidad_id: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => PeriodoMatricula, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: PeriodoMatricula;

  @ManyToOne(() => Pais, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nacionalidad_id' })
  nacionalidad: Pais;
}