import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRespuestasFormularioDto {
  @IsUUID('4', { message: 'El formulario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El formulario es obligatorio.' })
  formulario_id: string;

  @IsUUID('4', { message: 'El pregunta_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La pregunta es obligatoria.' })
  pregunta_id: string;

  @IsUUID('4', { message: 'El opcion_id debe ser un UUID válido.' })
  @IsOptional()
  opcion_id?: string;

  @IsString({ message: 'La respuesta de texto debe ser válida.' })
  @IsOptional()
  texto_respuesta?: string;
}