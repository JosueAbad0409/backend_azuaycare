import { Carrera } from "src/carreras/entities/carrera.entity";
import { Usuario } from "src/usuarios/entities/usuario.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: 'perfiles_coordinadores' })
export class PerfilCoordinador {
    @PrimaryGeneratedColumn('uuid')
    id: string; 

    @Column({name:'usuario_id', type: 'uuid', unique: true, nullable: false})
    usuario_id: string;

    @Column({name: 'titulo_profesional', type: 'varchar', length: 150, nullable: true})
    titulo_profesional: string | null;


    @Column({ name: 'mensaje_ayuda_estudiantes', type: 'varchar', length: 1000, nullable: true })
    mensaje_ayuda_estudiantes: string | null;

    @Column({name:'telefono_contacto', type: 'varchar', length: 20, nullable: true})
    telefono_contacto: string | null;


    @Column({name:'correo_contacto', type: 'varchar', length: 150, nullable: true})
    correo_contacto: string | null;

    @Column({name:'ubicacion_oficina', type: 'varchar', length: 150, nullable: true})
    ubicacion_oficina: string | null;


    @Column({name:'horario_atencion', type: 'varchar', length: 150, nullable: true})
    horario_atencion: string | null;

    @CreateDateColumn({type:'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP'})
    created_at: Date;

    @UpdateDateColumn({type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP'})
    updated_at: Date;

    //Relaciones

    @ManyToOne(() => Usuario, (usuario) => usuario.coordinaciones, {onDelete: 'CASCADE'})
    @JoinColumn({name:'usuario_id'})
    usuario: Usuario;

    @ManyToOne(() => Usuario, {onDelete: 'SET NULL', nullable: true})
    @JoinColumn({name: 'update_by'})
    actualizadoPor: Usuario | null;













}
