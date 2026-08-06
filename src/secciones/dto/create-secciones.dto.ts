import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, IsIn } from 'class-validator';

export class CreateSeccionDto {
  @IsUUID('4', { message: 'El formulario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El formulario asociado es obligatorio.' })
  formulario_id: string;

  @IsString({ message: 'El nombre de la sección debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la sección es obligatorio.' })
  nombre: string;

  @IsString({ message: 'La descripción de la sección debe ser un texto.' })
  @IsOptional()
  descripcion?: string;

  @IsNumber({}, { message: 'El orden debe ser un número entero.' })
  @Min(1, { message: 'El orden de la sección debe ser mínimo 1.' })
  @IsOptional()
  orden?: number;

  @IsString({ message: 'El tipo de sección debe ser un texto.' })
  @IsIn(['INFORMACION_GENERAL', 'FINANCIERA', 'NEE_SALUD'], {
    message: 'El tipo_seccion debe ser INFORMACION_GENERAL, FINANCIERA o NEE_SALUD.',
  })
  @IsOptional()
  tipo_seccion?: string;

  @IsString({ message: 'La subcategoría financiera debe ser un texto.' })
  @IsIn(['INGRESOS', 'GASTOS', 'NINGUNO', 'AMBOS'], {
    message: 'La subcategoria_financiera debe ser INGRESOS, GASTOS, NINGUNO o AMBOS.',
  })
  @IsOptional()
  subcategoria_financiera?: string;
}