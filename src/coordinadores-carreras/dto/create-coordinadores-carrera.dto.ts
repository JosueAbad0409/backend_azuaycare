import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCoordinadoresCarreraDto {
  @IsUUID('4', { message: 'El usuario_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El usuario coordinador es obligatorio.' })
  usuario_id: string;

  @IsUUID('4', { message: 'El carrera_id debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La carrera a coordinar es obligatoria.' })
  carrera_id: string;

  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  @IsOptional()
  activo?: boolean;
}