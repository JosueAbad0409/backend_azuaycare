import { IsNotEmpty, IsString, IsUUID, MaxLength, IsInt } from 'class-validator';

export class CreateDocumentosRespaldoDto {
  @IsUUID('4', { message: 'El respuesta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La respuesta asociada es obligatoria.' })
  respuesta_id: string;

  @IsString({ message: 'La ruta del documento debe ser texto.' })
  @IsNotEmpty({ message: 'La ruta del documento no puede estar vacía.' })
  ruta_archivo: string;

  @IsString({ message: 'El nombre original debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre original del archivo es obligatorio.' })
  @MaxLength(255)
  nombre_original: string;

  @IsString({ message: 'El mime_type debe ser texto.' })
  @IsNotEmpty({ message: 'El mime_type del archivo es obligatorio.' })
  @MaxLength(100)
  mime_type: string;

  @IsInt()
  @IsNotEmpty()
  tamanio_bytes: number;
}