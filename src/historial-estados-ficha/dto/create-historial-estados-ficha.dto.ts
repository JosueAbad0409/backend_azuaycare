import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHistorialEstadosFichaDto {
  @IsUUID('4')
  @IsNotEmpty()
  ficha_id: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  estado_anterior?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  estado_nuevo: string;

  @IsString()
  @IsOptional()
  comentario?: string;

  @IsUUID('4')
  @IsOptional()
  usuario_id?: string;
}