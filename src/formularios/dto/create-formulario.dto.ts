import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFormularioDto {
  @IsUUID('4', { message: 'El periodo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El periodo de matrícula es obligatorio.' })
  periodo_id: string;

  @IsString({ message: 'El título del formulario debe ser un texto.' })
  @IsNotEmpty({ message: 'El título del formulario es obligatorio.' })
  @MaxLength(255, { message: 'El título no puede superar los 255 caracteres.' })
  titulo: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsOptional()
  descripcion?: string;

  @IsString({ message: 'El tipo de formulario debe ser un texto.' })
  @IsOptional()
  tipo?: string;
}