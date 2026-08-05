import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsCedulaEcuatoriana } from 'src/common/is-cedula-ecuatoriana.validator';

export class CompletarPerfilDto {
  @IsString()
  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  @IsCedulaEcuatoriana({ message: 'La cédula ingresada no es válida.' })
  cedula: string;

  @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
  @IsOptional()
  carrera_id?: string;

  @IsUUID('4', { message: 'El ciclo_id debe ser un UUID válido.' })
  @IsOptional()
  ciclo_id?: string;
}