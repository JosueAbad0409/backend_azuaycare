import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf, IsDefined } from 'class-validator';
import { IsCedulaEcuatoriana } from 'src/common/is-cedula-ecuatoriana.validator';
import { IsFechaNacimiento } from 'src/common/is-fecha-nacimiento.validator';
import { EstadoCivilEnum, EtniaEnum, SexoEnum } from '../enums/perfil-usuario.enum';

export class CompletarPerfilDto {
  @IsString() @IsNotEmpty({ message: 'La cédula es obligatoria.' }) @IsCedulaEcuatoriana({ message: 'Cédula no válida.' })
  cedula: string;

  @IsEmail({}, { message: 'El correo institucional no es válido.' }) @IsOptional()
  email_institucional?: string;

  @IsString() @IsOptional() @MaxLength(100)
  primer_nombre?: string;

  @IsString() @IsOptional() @MaxLength(100)
  segundo_nombre?: string;

  @IsString() @IsOptional() @MaxLength(100)
  primer_apellido?: string;

  @IsString() @IsOptional() @MaxLength(100)
  segundo_apellido?: string;

  @IsEnum(SexoEnum, { message: 'El sexo debe ser Hombre o Mujer.' }) @IsNotEmpty({ message: 'El sexo es obligatorio.' })
  sexo: SexoEnum;

  @ValidateIf((dto: CompletarPerfilDto) => dto.sexo === SexoEnum.MUJER)
  @IsBoolean({ message: 'Indique su estado.' }) @IsDefined({ message: 'Especifique su estado (mujeres).' })
  esta_embarazada?: boolean;

  @IsString() @IsNotEmpty({ message: 'El género es obligatorio.' })
  genero: string;

  @IsEnum(EstadoCivilEnum, { message: 'Estado civil no válido.' }) @IsNotEmpty({ message: 'Estado civil obligatorio.' })
  estado_civil: EstadoCivilEnum;

  @IsBoolean({ message: 'Indique si tiene hijos.' }) @IsDefined({ message: '¿Tiene hijos? es obligatorio.' })
  tiene_hijos: boolean;

  @ValidateIf((dto: CompletarPerfilDto) => dto.tiene_hijos === true)
  @IsDefined({ message: 'Indique cuántos hijos menores de 5 años.' })
  hijos_menores_5_anios?: number;

  @IsEnum(EtniaEnum, { message: 'Etnia no válida.' }) @IsNotEmpty({ message: 'Etnia es obligatoria.' })
  etnia: EtniaEnum;

  @ValidateIf((dto: CompletarPerfilDto) => dto.etnia === EtniaEnum.INDIGENA)
  @IsString() @IsNotEmpty({ message: 'Especifique pueblo o nacionalidad.' })
  pueblo_nacionalidad?: string;

  @ValidateIf((dto: CompletarPerfilDto) => dto.etnia === EtniaEnum.OTRO)
  @IsString() @IsNotEmpty({ message: 'Especifique su etnia.' }) @MaxLength(100)
  etnia_otra?: string;

  @IsString() @IsNotEmpty({ message: 'El idioma es obligatorio.' }) @MaxLength(100)
  idioma: string;

  @IsString() @IsNotEmpty({ message: 'Lugar de nacimiento obligatorio.' }) @MaxLength(150)
  lugar_nacimiento: string;

  @IsString() @IsNotEmpty({ message: 'Fecha de nacimiento obligatoria.' }) @IsFechaNacimiento()
  fecha_nacimiento: string;

  @IsUUID('4', { message: 'ID de nacionalidad no válido.' }) @IsNotEmpty({ message: 'Nacionalidad obligatoria.' })
  nacionalidad_id: string;

  @IsUUID('4', { message: 'carrera_id no válido.' }) @IsOptional()
  carrera_id?: string;

  @IsUUID('4', { message: 'ciclo_id no válido.' }) @IsOptional()
  ciclo_id?: string;
}