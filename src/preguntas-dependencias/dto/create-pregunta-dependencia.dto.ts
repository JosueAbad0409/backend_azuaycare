import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePreguntaDependenciaDto {
  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta afectada es obligatoria.' })
  pregunta_id: string;

  @IsUUID('4', { message: 'El pregunta_disparadora_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta disparadora es obligatoria.' })
  pregunta_disparadora_id: string;

  @IsUUID('4', { message: 'El opcion_disparadora_id debe ser un UUID válido.' })
  @IsOptional()
  opcion_disparadora_id?: string;
  
  @IsString({ message: 'El valor disparador debe ser una cadena válida.' })
  @MaxLength(255, { message: 'El valor disparador no puede superar los 255 caracteres.' })
  @IsOptional()
  valor_disparador?: string;
}