import { IsBoolean, IsNotEmpty, IsString, IsDate, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePeriodoMatriculaDto {
  @IsString({ message: 'El nombre del periodo debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del periodo es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres.' })
  nombre: string;

  @Type(() => Date)
  @IsDate({ message: 'La fecha de inicio debe ser una fecha válida.' })
  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria.' })
  fecha_inicio: Date;

  @Type(() => Date)
  @IsDate({ message: 'La fecha de fin debe ser una fecha válida.' })
  @IsNotEmpty({ message: 'La fecha de fin es obligatoria.' })
  fecha_fin: Date;

  @IsBoolean({ message: 'El estado activo debe ser un valor booleano (true o false).' })
  @IsOptional()
  activo?: boolean;
}