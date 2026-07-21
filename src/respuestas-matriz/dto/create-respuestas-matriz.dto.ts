import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRespuestasMatrizDto {
  @IsUUID('4', { message: 'El respuesta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La respuesta principal asociada es obligatoria.' })
  respuesta_id: string;

  @IsUUID('4', { message: 'El fila_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La fila de la matriz es obligatoria.' })
  fila_id: string;

  @IsUUID('4', { message: 'El columna_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La columna de la matriz es obligatoria.' })
  columna_id: string;

  @IsString({ message: 'El valor de la celda debe ser un texto.' })
  @IsOptional()
  valor_texto?: string;
}