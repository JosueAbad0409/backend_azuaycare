import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFormularioDto {
  @IsString({ message: 'El tipo de formulario debe ser un texto.' })
  @IsOptional()
  tipo?: string;

  @IsUUID('4', { message: 'El periodo_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El periodo de matrícula es obligatorio.' })
  periodo_id: string;
}