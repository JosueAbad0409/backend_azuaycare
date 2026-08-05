import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEmail, MaxLength } from 'class-validator';

export class CreatePerfilCoordinadorDto {
    @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'El ID del usuario es obligatorio para crear su perfil.' })
    usuario_id: string;

    @IsString({ message: 'El título profesional debe ser un texto.' })
    @IsOptional()
    @MaxLength(150)
    titulo_profesional?: string;

    @IsString({ message: 'La ubicación de oficina debe ser un texto.' })
    @IsOptional()
    @MaxLength(150)
    ubicacion_oficina?: string;

    @IsString({ message: 'El horario de atención debe ser un texto.' })
    @IsOptional()
    @MaxLength(150)
    horario_atencion?: string;

    @IsString({ message: 'El teléfono debe ser un texto.' })
    @IsOptional()
    @MaxLength(20, { message: 'El teléfono no puede superar los 20 caracteres.' })
    telefono_contacto?: string;

    @IsEmail({}, { message: 'El correo de contacto no es válido.' })
    @IsOptional()
    correo_contacto?: string;

    @IsString({ message: 'El mensaje de ayuda debe ser un texto.' })
    @IsOptional()
    @MaxLength(1000)
    mensaje_ayuda_estudiantes?: string;
}