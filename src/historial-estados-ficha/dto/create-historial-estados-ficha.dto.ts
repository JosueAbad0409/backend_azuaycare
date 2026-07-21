import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHistorialEstadosFichaDto {
  @IsUUID('4', { message: 'El ficha_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La ficha asociada es obligatoria.' })
  ficha_id: string;

  @IsString({ message: 'El estado anterior debe ser un texto.' })
  @IsOptional()
  @MaxLength(30, { message: 'El estado anterior no puede superar los 30 caracteres.' })
  estado_anterior?: string;

  @IsString({ message: 'El estado nuevo debe ser un texto.' })
  @IsNotEmpty({ message: 'El nuevo estado de la ficha es obligatorio.' })
  @MaxLength(30, { message: 'El estado nuevo no puede superar los 30 caracteres.' })
  estado_nuevo: string;

  @IsString({ message: 'El comentario debe ser un texto.' })
  @IsOptional()
  comentario?: string;

  @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
  @IsOptional()
  usuario_id?: string;
}