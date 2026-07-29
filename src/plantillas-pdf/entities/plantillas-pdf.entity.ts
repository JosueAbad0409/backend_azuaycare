import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Formulario } from '../../formularios/entities/formulario.entity';

@Entity({ name: 'plantillas_pdf' })
export class PlantillaPdf {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'formulario_id', type: 'uuid', nullable: false, unique: true })
    formulario_id: string;

    @Column({ type: 'varchar', nullable: true })
    logo_url: string;

    @Column({ type: 'varchar', length: 20, default: '#003366' })
    color_primario: string;

    @Column({ type: 'varchar', length: 20, default: '#666666' })
    color_secundario: string;

    @Column({ type: 'text', nullable: true })
    encabezado: string;

    @Column({ type: 'text', nullable: true })
    pie_pagina: string;

    @Column({ type: 'boolean', default: true })
    mostrar_tabla_rango: boolean;

    @ManyToOne(() => Formulario, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'formulario_id' })
    formulario: Formulario;
}