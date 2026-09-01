import { IsOptional, IsString, IsUUID, IsArray, IsDateString, IsBoolean, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
  @IsString()
  nivel_economico?: string;

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

  // ---- Nuevos filtros demográficos (explorador de población) ----
  @IsOptional()
  @IsString()
  sexo?: string;

  @IsOptional()
  @IsString()
  etnia?: string;

  @IsOptional()
  @IsString()
  zona_residencia?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  tiene_discapacidad?: boolean;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiltroPreguntaDto)
  preguntas?: FiltroPreguntaDto[];

  @IsOptional()
  @IsString()
  vista?: 'completo' | 'poblacion';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columnas_base?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  columnas_pregunta_ids?: string[];

}