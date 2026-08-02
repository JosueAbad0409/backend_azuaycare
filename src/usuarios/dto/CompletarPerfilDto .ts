import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class CompletarPerfilDto {
    @IsString()
    @IsNotEmpty({ message: 'La cédula es obligatoria.' })
    @Matches(/^[0-9]{10}$/, { message: 'La cédula debe contener exactamente 10 dígitos numéricos.' })
    cedula: string;

    @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'La carrera es obligatoria.' })
    carrera_id: string;

    @IsUUID('4', { message: 'El ciclo_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'El ciclo es obligatorio.' })
    ciclo_id: string;
}