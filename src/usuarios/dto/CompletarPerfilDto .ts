import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { IsCedulaEcuatoriana } from 'src/common/is-cedula-ecuatoriana.validator';

export class CompletarPerfilDto {
    @IsString()
    @IsNotEmpty({ message: 'La cédula es obligatoria.' })
    @IsCedulaEcuatoriana({ message: 'La cédula ingresada no es válida.' })
    cedula: string;

    @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'La carrera es obligatoria.' })
    carrera_id: string;

    @IsUUID('4', { message: 'El ciclo_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'El ciclo es obligatorio.' })
    ciclo_id: string;
}