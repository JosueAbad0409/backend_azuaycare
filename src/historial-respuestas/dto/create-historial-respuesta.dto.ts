import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// 1. Definimos la estructura base de los valores (texto y numérico)
class ValoresCambioDto {
  @IsString({ message: 'El valor de texto debe ser una cadena válida.' })
  @IsOptional()
  valor_texto?: string;

  @IsNumber({}, { message: 'El valor numérico debe ser un número válido.' })
  @IsOptional()
  valor_numerico?: number;
}

// 2. Definimos la estructura del JSONB que contendrá los datos anteriores y nuevos
class CambiosRealizadosDto {
  @ValidateNested()
  @Type(() => ValoresCambioDto)
  @IsNotEmpty({ message: 'El bloque de datos_anteriores es obligatorio.' })
  datos_anteriores: ValoresCambioDto;

  @ValidateNested()
  @Type(() => ValoresCambioDto)
  @IsNotEmpty({ message: 'El bloque de datos_nuevos es obligatorio.' })
  datos_nuevos: ValoresCambioDto;
}

// 3. Tu DTO principal actualizado
export class CreateHistorialRespuestaDto {
  @IsUUID('4', { message: 'El respuesta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La respuesta afectada es obligatoria.' })
  respuesta_id: string;

  @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El usuario que realizó el cambio es obligatorio.' })
  usuario_id: string;

  // 🔥 SOLUCIÓN AUDITORÍA: Reemplazamos las 4 columnas sueltas por el objeto JSONB validado
  @ValidateNested()
  @Type(() => CambiosRealizadosDto)
  @IsNotEmpty({ message: 'El registro de los cambios realizados es obligatorio.' })
  cambios_realizados: CambiosRealizadosDto;
}