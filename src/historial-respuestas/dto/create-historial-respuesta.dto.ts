import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHistorialRespuestaDto {
  @IsUUID('4', { message: 'El respuesta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La respuesta afectada es obligatoria.' })
  respuesta_id: string;

  @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El usuario que realizó el cambio es obligatorio.' })
  usuario_id: string;

  @IsString({ message: 'El valor de texto anterior debe ser una cadena válida.' })
  @IsOptional()
  valor_texto_anterior?: string;

  @IsNumber({}, { message: 'El valor numérico anterior debe ser un número válido.' })
  @IsOptional()
  valor_numerico_anterior?: number;

  @IsString({ message: 'El valor de texto nuevo debe ser una cadena válida.' })
  @IsOptional()
  valor_texto_nuevo?: string;

  @IsNumber({}, { message: 'El valor numérico nuevo debe ser un número válido.' })
  @IsOptional()
  valor_numerico_nuevo?: number;
}