import { IsNotEmpty, IsString, IsNumber, IsUUID, IsOptional, Min, MaxLength, IsInt } from 'class-validator';

export class CreateNivelesEconomicoDto {
  @IsString({ message: 'El nombre del nivel debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del nivel económico es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre: string;

  @IsNumber({}, { message: 'El valor mínimo debe ser un número válido.' })
  @Min(0, { message: 'El valor mínimo no puede ser negativo.' })
  @IsNotEmpty({ message: 'El valor mínimo es obligatorio.' })
  valor_min: number;

  @IsNumber({}, { message: 'El valor máximo debe ser un número válido.' })
  @Min(0, { message: 'El valor máximo no puede ser negativo.' })
  @IsOptional()
  valor_max?: number;

  @IsUUID('4', { message: 'El periodo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El periodo de matrícula asociado es obligatorio.' })
  periodo_id: string;

  @IsInt({ message: 'El orden de jerarquía debe ser un número entero.' })
  @IsOptional()
  orden?: number;
}