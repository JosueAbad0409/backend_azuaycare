import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Formulario } from '../../formularios/entities/formulario.entity';

@Entity({ name: 'rangos_variable_calculada' })
export class RangoVariableCalculada {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'formulario_id', type: 'uuid', nullable: false })
    formulario_id: string;

    @Column({ name: 'variable_calculo', type: 'varchar', length: 50, nullable: false })
    variable_calculo: string;

    @Column({ type: 'varchar', length: 150, nullable: false })
    nombre: string;

    @Column({ type: 'numeric', nullable: false })
    valor_min: number;

    @Column({ type: 'numeric', nullable: false })
    valor_max: number;

    // 🔴 COLUMNA QUE FALTABA
    @Column({ type: 'boolean', default: false })
    es_vulnerable: boolean;

    @Column({ type: 'integer', default: 1 })
    orden: number;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    fecha_desactivacion: Date | null;

    @ManyToOne(() => Formulario, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'formulario_id' })
    formulario: Formulario;
}