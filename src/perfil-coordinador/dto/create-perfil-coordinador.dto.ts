import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePerfilCoordinadorDto {
    @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'El ID del usuario es obligatorio para crear su perfil.' })
    usuario_id: string;

    @IsString({ message: 'El teléfono debe ser un texto.' })
    @IsOptional()
    @MaxLength(20, { message: 'El teléfono no puede superar los 20 caracteres.' })
    telefono?: string;

    @IsString({ message: 'El mensaje de ayuda debe ser un texto.' })
    @IsOptional()
    mensaje_ayuda_estudiantes?: string;
}