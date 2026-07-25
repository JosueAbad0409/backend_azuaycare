// src/preguntas/dto/create-pregunta.dto.ts
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePreguntaDto {
  @IsUUID('4', { message: 'El seccion_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La sección a la que pertenece la pregunta es obligatoria.' })
  seccion_id: string;

  @IsString({ message: 'El enunciado debe ser texto.' })
  @IsNotEmpty({ message: 'El enunciado de la pregunta es obligatorio.' })
  enunciado: string;

  @IsUUID('4', { message: 'El tipo_campo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El tipo de campo es obligatorio.' })
  tipo_campo_id: string;

  @IsString({ message: 'La categoría financiera debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'La categoría financiera no puede superar los 50 caracteres.' })
  categoria_financiera?: string;

  @IsString({ message: 'La variable de cálculo debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'La variable de cálculo no puede superar los 50 caracteres.' })
  variable_calculo?: string;

  @IsBoolean({ message: 'El campo es_obligatorio debe ser un booleano (true o false).' })
  @IsOptional()
  es_obligatorio?: boolean;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden mínimo permitido es 1.' })
  @IsOptional()
  orden?: number;

  @IsString({ message: 'El código del sistema debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'El código del sistema no puede superar los 50 caracteres.' })
  codigo_sistema?: string;

  @IsBoolean({ message: 'requiere_evidencia debe ser un booleano (true o false).' })
  @IsOptional()
  requiere_evidencia?: boolean;
}