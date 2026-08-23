import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCicloDto {
  @IsString({ message: 'El nombre del ciclo debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del ciclo es obligatorio.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  nombre: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden debe ser como mínimo 1.' })
  @IsNotEmpty({ message: 'El número u orden del ciclo es obligatorio.' })
  orden: number;

  // Un ciclo ahora puede pertenecer a una o varias carreras
  @IsArray({ message: 'carrera_ids debe ser un arreglo.' })
  @ArrayNotEmpty({ message: 'Debe asociar el ciclo a al menos una carrera.' })
  @ArrayUnique({ message: 'No se puede repetir la misma carrera.' })
  @IsUUID('4', { each: true, message: 'Cada carrera_id debe ser un UUID válido.' })
  carrera_ids: string[];
}
