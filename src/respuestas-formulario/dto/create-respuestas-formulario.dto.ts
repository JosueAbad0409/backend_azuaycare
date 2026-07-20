import { IsNotEmpty, IsOptional, IsString, IsNumber, IsUUID, IsArray } from 'class-validator';

export class CreateRespuestasFormularioDto {
  @IsUUID('4', { message: 'El ficha_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La asociación a la ficha respondida es obligatoria.' })
  ficha_id: string;

  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta es obligatoria.' })
  pregunta_id: string;

  @IsString({ message: 'El valor de texto debe ser una cadena válida.' })
  @IsOptional()
  valor_texto?: string;

  @IsNumber({}, { message: 'El valor numérico debe ser un número válido.' })
  @IsOptional()
  valor_numerico?: number;

  @IsArray({ message: 'Las opciones seleccionadas deben enviarse en una lista.' })
  @IsUUID('4', { each: true, message: 'Cada opción debe ser un UUID válido.' })
  @IsOptional()
  opciones_seleccionadas?: string[];
}