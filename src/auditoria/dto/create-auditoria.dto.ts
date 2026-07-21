import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAuditoriaDto {
  @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
  @IsOptional()
  usuario_id?: string;

  @IsString({ message: 'La tabla afectada debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la tabla afectada es obligatorio.' })
  @MaxLength(100, { message: 'El nombre de la tabla no puede superar los 100 caracteres.' })
  tabla_afectada: string;

  @IsString({ message: 'La acción debe ser un texto.' })
  @IsNotEmpty({ message: 'La acción (ej. INSERT, UPDATE) es obligatoria.' })
  @MaxLength(50, { message: 'La acción no puede superar los 50 caracteres.' })
  accion: string;

  @IsUUID('4', { message: 'El registro_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del registro afectado es obligatorio.' })
  registro_id: string;

  @IsObject({ message: 'Los datos anteriores deben tener un formato de objeto (JSON) válido.' })
  @IsOptional()
  datos_anteriores?: any;

  @IsObject({ message: 'Los datos nuevos deben tener un formato de objeto (JSON) válido.' })
  @IsOptional()
  datos_nuevos?: any;
}