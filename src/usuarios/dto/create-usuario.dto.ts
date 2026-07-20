import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El google_id es obligatorio.' })
  google_id: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo institucional es obligatorio.' })
  email_institucional: string;

  @IsString()
  @IsNotEmpty({ message: 'El primer nombre es obligatorio.' })
  primer_nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El primer apellido es obligatorio.' })
  primer_apellido: string;

  @IsString()
  @IsOptional()
  segundo_nombre?: string;

  @IsString()
  @IsOptional()
  segundo_apellido?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'La cédula debe contener exactamente 10 dígitos numéricos.' })
  cedula?: string;

  @IsUUID('4', { message: 'El rol_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El rol_id es obligatorio.' })
  rol_id: string;

  @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
  @IsOptional()
  carrera_id?: string;
}