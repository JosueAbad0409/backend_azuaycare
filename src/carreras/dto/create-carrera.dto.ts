import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCarreraDto {
  @IsString({ message: 'El nombre de la carrera debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la carrera es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  nombre: string;
}