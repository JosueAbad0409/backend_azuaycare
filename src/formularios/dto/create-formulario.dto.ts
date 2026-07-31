import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateFormularioDto {
  @IsUUID('4', { message: 'El periodo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El periodo de matrícula es obligatorio.' })
  periodo_id: string;

  // ✅ NUEVO: reemplaza a "tipo: string"
  @IsUUID('4', { message: 'El tipo de formulario debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El tipo de formulario es obligatorio.' })
  tipo_formulario_id: string;

  @IsString({ message: 'El título del formulario debe ser un texto.' })
  @IsNotEmpty({ message: 'El título del formulario es obligatorio.' })
  @MaxLength(255, { message: 'El título no puede superar los 255 caracteres.' })
  titulo: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsOptional()
  descripcion?: string;

  // ❌ ELIMINADO: @IsString() @IsOptional() tipo?: string;

  @IsInt({ message: 'Los días de plazo de modificación deben ser un número entero.' })
  @Min(1, { message: 'El plazo debe ser de al menos 1 día.' })
  @IsOptional()
  dias_plazo_modificacion?: number | null;

  @IsString({ message: 'El tipo de sección debe ser un texto.' })
  @IsOptional()
  tipo_seccion?: string;

  @IsString({ message: 'La subcategoría financiera debe ser un texto.' })
  @IsOptional()
  subcategoria_financiera?: string;
}