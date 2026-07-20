import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOpcionPreguntaDto {
  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta asociada es obligatoria.' })
  pregunta_id: string;

  @IsString({ message: 'El texto de la opción debe ser una cadena válida.' })
  @IsNotEmpty({ message: 'El texto de la opción es obligatorio.' })
  texto_opcion: string;

  @IsNumber({}, { message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden de la opción debe ser mínimo 1.' })
  @IsOptional()
  orden?: number;

  @IsBoolean()
  @IsOptional()
  permite_texto_libre?: boolean;
}