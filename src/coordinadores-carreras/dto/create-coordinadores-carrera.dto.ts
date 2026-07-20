import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCoordinadoresCarreraDto {
  @IsUUID('4')
  @IsNotEmpty()
  usuario_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  carrera_id: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}