import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOpcionPreguntaDto {
  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsOptional() 
  pregunta_id?: string;

  @IsString({ message: 'El texto de la opción debe ser una cadena válida.' })
  @IsNotEmpty({ message: 'El texto de la opción es obligatorio.' })
  texto_opcion: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden de la opción debe ser mínimo 1.' })
  @IsOptional()
  orden?: number;

  @IsBoolean({ message: 'permite_texto_libre debe ser un valor booleano.' })
  @IsOptional()
  permite_texto_libre?: boolean;

  @IsNumber({}, { message: 'El valor ponderado debe ser un número.' })
  @IsOptional()
  valor_ponderado?: number;

  @IsBoolean({ message: 'dispara_dependencia debe ser un valor booleano.' })
  @IsOptional()
  dispara_dependencia?: boolean;

  @IsUUID('4', { message: 'El pregunta_hija_id debe ser un UUID válido.' })
  @IsOptional()
  pregunta_hija_id?: string;

  // 🔥 NUEVO CAMPO AÑADIDO:
  @IsBoolean({ message: 'es_correcta debe ser un valor booleano.' })
  @IsOptional()
  es_correcta?: boolean;

  @IsInt({ message: 'El puntaje de riesgo debe ser un número entero.' })
  @Min(0, { message: 'El puntaje de riesgo no puede ser negativo.' })
  @IsOptional()
  puntaje_riesgo?: number;
  
}