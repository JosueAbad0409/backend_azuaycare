import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHistorialRespuestaDto {
  @IsUUID('4')
  @IsNotEmpty()
  respuesta_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  usuario_id: string;

  @IsString()
  @IsOptional()
  valor_texto_anterior?: string;

  @IsNumber()
  @IsOptional()
  valor_numerico_anterior?: number;

  @IsString()
  @IsOptional()
  valor_texto_nuevo?: string;

  @IsNumber()
  @IsOptional()
  valor_numerico_nuevo?: number;
}