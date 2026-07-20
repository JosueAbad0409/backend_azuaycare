import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, MaxLength } from 'class-validator';

export class CreateFilaMatrizDto {
  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta matriz es obligatoria.' })
  pregunta_id: string;

  @IsString({ message: 'El texto de la fila debe ser texto.' })
  @IsNotEmpty({ message: 'El texto de la fila no puede estar vacío.' })
  @MaxLength(255)
  texto_fila: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden mínimo es 1.' })
  @IsOptional()
  orden?: number;
}

export class CreateColumnaMatrizDto {
  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta matriz es obligatoria.' })
  pregunta_id: string;

  @IsString({ message: 'El texto de la columna debe ser texto.' })
  @IsNotEmpty({ message: 'El texto no puede estar vacío.' })
  @MaxLength(255)
  texto_columna: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden mínimo es 1.' })
  @IsOptional()
  orden?: number;
}