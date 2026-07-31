import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Formulario } from '../../formularios/entities/formulario.entity';

// Representa un TIPO de ficha (Ej: "Ficha Socioeconómica", "Ficha de Salud", "Ficha Mental").
// Un TipoFormulario NO contiene preguntas: es solo la categoría/plantilla conceptual.
// Los formularios reales (con secciones y preguntas) viven en la tabla "formularios"
// y cada uno apunta a un tipo_formulario_id + un periodo_id.
@Entity({ name: 'tipos_formulario' })
export class TipoFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false, unique: true })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  // Clase de ícono (ej. FontAwesome: 'fa-wallet', 'fa-heart-pulse', 'fa-brain') para la UI.
  @Column({ type: 'varchar', length: 50, nullable: true })
  icono: string | null;

  // Color identificador para badges/UI (ej. '#8b5cf6').
  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fecha_desactivacion: Date | null;

  // Todas las versiones (de todos los periodos) de formularios de este tipo.
  @OneToMany(() => Formulario, (formulario) => formulario.tipoFormulario)
  formularios: Formulario[];
}