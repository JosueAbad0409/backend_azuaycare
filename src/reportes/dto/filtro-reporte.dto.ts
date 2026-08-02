import { IsOptional, IsString, IsUUID, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FiltroPreguntaDto {
  @IsUUID()
  pregunta_id!: string;

  @IsOptional()
  @IsUUID()
  opcion_id?: string;

  @IsOptional()
  valor_min?: number;

  @IsOptional()
  valor_max?: number;

  @IsOptional()
  @IsString()
  texto?: string;
}

export class FiltroReporteDto {
  @IsOptional()
  @IsUUID()
  periodo_id?: string;

  @IsOptional()
  @IsUUID()
  formulario_id?: string;

  @IsOptional()
  @IsUUID()
  carrera_id?: string;

  @IsOptional()
  @IsUUID()
  ciclo_id?: string;

  @IsOptional()
  @IsString()
  estado_ficha?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  estados_ficha?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tipo_usuario?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cursos?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiltroPreguntaDto)
  preguntas?: FiltroPreguntaDto[];
}
