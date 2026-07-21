import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateSeccionDto {
  @IsUUID('4', { message: 'El formulario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El formulario asociado es obligatorio.' })
  formulario_id: string;

  @IsString({ message: 'El nombre de la sección debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la sección es obligatorio.' })
  nombre: string;

  @IsString({ message: 'La descripción de la sección debe ser un texto.' })
  @IsOptional()
  descripcion?: string;

  @IsNumber({}, { message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden de la sección debe ser mínimo 1.' })
  @IsOptional()
  orden?: number;
}