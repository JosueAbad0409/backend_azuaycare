import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAuditoriaDto {
  @IsUUID('4')
  @IsOptional()
  usuario_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tabla_afectada: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accion: string;

  @IsUUID('4')
  @IsNotEmpty()
  registro_id: string;

  @IsObject()
  @IsOptional()
  datos_anteriores?: any;

  @IsObject()
  @IsOptional()
  datos_nuevos?: any;
}