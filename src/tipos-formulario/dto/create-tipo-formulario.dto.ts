import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTipoFormularioDto {
  @IsString({ message: 'El nombre del tipo de formulario debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del tipo de formulario es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsOptional()
  descripcion?: string;

  @IsString({ message: 'El ícono debe ser un texto (ej. fa-wallet).' })
  @IsOptional()
  @MaxLength(50)
  icono?: string;

  @IsString({ message: 'El color debe ser un texto (ej. #8b5cf6).' })
  @IsOptional()
  @MaxLength(20)
  color?: string;
}