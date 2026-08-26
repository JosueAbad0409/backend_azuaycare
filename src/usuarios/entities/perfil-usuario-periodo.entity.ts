import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';
import { Pais } from 'src/ubicaciones/entities/pais.entity';
import { Provincia } from 'src/ubicaciones/entities/provincia.entity';
import { Canton } from 'src/ubicaciones/entities/canton.entity';
import {
  EstadoCivilEnum,
  EtniaEnum,
  RangoEdadEnum,
  SexoEnum,
  ZonaResidenciaEnum,
} from '../enums/perfil-usuario.enum';

@Entity({ name: 'perfiles_usuario_periodo' })
@Index(['usuario_id', 'periodo_id'], { unique: true })
export class PerfilUsuarioPeriodo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: false })
  usuario_id: string;

  @Column({ name: 'periodo_id', type: 'uuid', nullable: false })
  periodo_id: string;

  @Column({ name: 'numero_celular', type: 'varchar', length: 10, nullable: false })
  numero_celular: string;

  @Column({ type: 'enum', enum: SexoEnum, nullable: false })
  sexo: SexoEnum;

  @Column({ name: 'estado_civil', type: 'enum', enum: EstadoCivilEnum, nullable: false })
  estado_civil: EstadoCivilEnum;

  @Column({ name: 'tiene_hijos', type: 'boolean', nullable: false })
  tiene_hijos: boolean;

  @Column({ type: 'enum', enum: EtniaEnum, nullable: false })
  etnia: EtniaEnum;

  @Column({ type: 'varchar', length: 100, nullable: false })
  idioma: string;

  // 🔥 NUEVOS CAMPOS GEOGRÁFICOS RELACIONALES (IDs)
  @Column({ name: 'nacionalidad_id', type: 'uuid', nullable: false })
  nacionalidad_id: string;

  @Column({ name: 'pais_residencia_id', type: 'uuid', nullable: false })
  pais_residencia_id: string;

  @Column({ name: 'provincia_residencia_id', type: 'uuid', nullable: true })
  provincia_residencia_id: string | null;

  @Column({ name: 'canton_residencia_id', type: 'uuid', nullable: true })
  canton_residencia_id: string | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: false })
  fecha_nacimiento: Date;

  @Column({ name: 'rango_edad', type: 'enum', enum: RangoEdadEnum, nullable: false })
  rango_edad: RangoEdadEnum;

  @Column({ name: 'esta_embarazada', type: 'boolean', nullable: true })
  esta_embarazada: boolean | null;

  @Column({ name: 'tiene_discapacidad', type: 'boolean', nullable: false })
  tiene_discapacidad: boolean;

  @Column({ name: 'tipo_discapacidad', type: 'varchar', length: 150, nullable: true })
  tipo_discapacidad: string | null;

  @Column({ name: 'zona_residencia', type: 'enum', enum: ZonaResidenciaEnum, nullable: false })
  zona_residencia: ZonaResidenciaEnum;

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

  // Relaciones con Ubicaciones
  @ManyToOne(() => Pais, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nacionalidad_id' })
  nacionalidad: Pais;

  @ManyToOne(() => Pais, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pais_residencia_id' })
  pais_residencia: Pais;

  @ManyToOne(() => Provincia, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'provincia_residencia_id' })
  provincia_residencia: Provincia;

  @ManyToOne(() => Canton, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'canton_residencia_id' })
  canton_residencia: Canton;
}