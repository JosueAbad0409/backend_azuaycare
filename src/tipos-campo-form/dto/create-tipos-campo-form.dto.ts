import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTipoCampoFormDto {
  @IsString({ message: 'El nombre del tipo de campo debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del tipo de campo es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsOptional()
  descripcion?: string;
}