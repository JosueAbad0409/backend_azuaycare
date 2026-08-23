import { IsNotEmpty, IsString, IsUUID, MaxLength, IsInt, IsOptional } from 'class-validator';

export class CreateDocumentosRespaldoDto {
  @IsOptional()
  @IsUUID('4', { message: 'El respuesta_id debe ser un UUID válido.' })
  respuesta_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ficha_id debe ser un UUID válido.' })
  ficha_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El perfil_periodo_id debe ser un UUID válido.' })
  perfil_periodo_id?: string;

  @IsString({ message: 'La ruta del documento debe ser texto.' })
  @IsNotEmpty({ message: 'La ruta del documento no puede estar vacía.' })
  ruta_archivo: string;

  @IsString({ message: 'El nombre original debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre original del archivo es obligatorio.' })
  @MaxLength(255, { message: 'El nombre original no puede superar los 255 caracteres.' })
  nombre_original: string;

  @IsString({ message: 'El mime_type debe ser texto.' })
  @IsNotEmpty({ message: 'El mime_type del archivo es obligatorio.' })
  @MaxLength(100, { message: 'El mime_type no puede superar los 100 caracteres.' })
  mime_type: string;

  @IsInt({ message: 'El tamaño en bytes debe ser un número entero.' })
  @IsNotEmpty({ message: 'El tamaño del archivo es obligatorio.' })
  tamanio_bytes: number;
}