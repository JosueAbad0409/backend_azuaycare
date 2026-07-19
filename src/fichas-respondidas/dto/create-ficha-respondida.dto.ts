import { IsNotEmpty, IsUUID, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class CreateFichaRespondidaDto {
  @IsUUID('4', { message: 'El periodo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El periodo de matrícula es obligatorio.' })
  periodo_id: string;

  @IsUUID('4', { message: 'El formulario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El formulario asociado es obligatorio.' })
  formulario_id: string;

  @IsNumber({}, { message: 'El total de ingresos debe ser un número.' })
  @Min(0, { message: 'El total de ingresos no puede ser negativo.' })
  @IsOptional()
  total_ingresos?: number;

  @IsNumber({}, { message: 'El total de egresos debe ser un número.' })
  @Min(0, { message: 'El total de egresos no puede ser negativo.' })
  @IsOptional()
  total_egresos?: number;

  @IsString({ message: 'El estado de la ficha debe ser un texto válido.' })
  @IsOptional()
  estado_ficha?: string;
}