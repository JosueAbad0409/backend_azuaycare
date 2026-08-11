import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCicloDto {
  @IsString({ message: 'El nombre del ciclo debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del ciclo es obligatorio.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  nombre: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden debe ser como mínimo 1.' })
  @IsNotEmpty({ message: 'El número u orden del ciclo es obligatorio.' })
  orden: number;
  
  @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La carrera asociada es obligatoria.' })
  carrera_id: string;
}