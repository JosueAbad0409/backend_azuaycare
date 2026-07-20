// src/preguntas/dto/create-pregunta.dto.ts
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePreguntaDto {
  @IsUUID('4', { message: 'El seccion_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La sección asociada es obligatoria.' })
  seccion_id: string;

  // Cambiado de texto_pregunta a enunciado para acoplarse a la Entidad y SQL
  @IsString({ message: 'El enunciado de la pregunta debe ser una cadena válida.' })
  @IsNotEmpty({ message: 'El enunciado de la pregunta es obligatorio.' })
  enunciado: string;

  @IsUUID('4', { message: 'El tipo_campo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El tipo de campo es obligatorio.' })
  tipo_campo_id: string;

  @IsBoolean({ message: 'El campo obligatorio debe ser booleano.' })
  @IsOptional()
  obligatorio?: boolean;

  @IsNumber({}, { message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden de la pregunta debe ser mínimo 1.' })
  @IsOptional()
  orden?: number;
}