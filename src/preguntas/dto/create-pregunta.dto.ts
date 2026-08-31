import { 
  IsBoolean, 
  IsInt, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  MaxLength, 
  Min, 
  IsArray, 
  ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOpcionPreguntaDto } from '../../opciones-pregunta/dto/create-opciones-pregunta.dto';

export class CreateFilaMatrizDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  texto_fila: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1)
  @IsOptional()
  orden?: number;

  @IsBoolean()
  @IsOptional()
  es_multiple?: boolean;

  @IsBoolean()
  @IsOptional()
  permitir_multiple?: boolean;
}

export class CreateColumnaMatrizDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  texto_columna: string;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1)
  @IsOptional()
  orden?: number;
}

export class CreatePreguntaDto {
  @IsUUID('4', { message: 'El seccion_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La sección a la que pertenece la pregunta es obligatoria.' })
  seccion_id: string;

  @IsString({ message: 'El enunciado debe ser texto.' })
  @IsNotEmpty({ message: 'El enunciado de la pregunta es obligatorio.' })
  enunciado: string;

  @IsUUID('4', { message: 'El tipo_campo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El tipo de campo es obligatorio.' })
  tipo_campo_id: string;

  @IsString({ message: 'La categoría financiera debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'La categoría financiera no puede superar los 50 caracteres.' })
  categoria_financiera?: string;

  @IsString({ message: 'La variable de cálculo debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'La variable de cálculo no puede superar los 50 caracteres.' })
  variable_calculo?: string;

  @IsBoolean({ message: 'El campo es_obligatorio debe ser un booleano.' })
  @IsOptional()
  es_obligatorio?: boolean;

  @IsInt({ message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden mínimo permitido es 1.' })
  @IsOptional()
  orden?: number;

  @IsString({ message: 'El código del sistema debe ser texto.' })
  @IsOptional()
  @MaxLength(50, { message: 'El código del sistema no puede superar los 50 caracteres.' })
  codigo_sistema?: string;

  @IsBoolean({ message: 'requiere_evidencia debe ser un booleano.' })
  @IsOptional()
  requiere_evidencia?: boolean;

  @IsBoolean({ message: 'revision_manual_obligatoria debe ser un booleano.' })
  @IsOptional()
  revision_manual_obligatoria?: boolean;

  @IsBoolean({ message: 'permitir_multiple_matriz debe ser un booleano.' })
  @IsOptional()
  permitir_multiple_matriz?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateOpcionPreguntaDto)
  opciones?: CreateOpcionPreguntaDto[];

  // ✅ NUEVA: Filas de matriz
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFilaMatrizDto)
  filasMatriz?: CreateFilaMatrizDto[];

  // ✅ NUEVA: Columnas de matriz
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateColumnaMatrizDto)
  columnasMatriz?: CreateColumnaMatrizDto[];
}