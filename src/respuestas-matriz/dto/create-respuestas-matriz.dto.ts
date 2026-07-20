import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateRespuestasMatrizDto {
  @IsUUID('4')
  @IsNotEmpty()
  respuesta_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  fila_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  columna_id: string;
}