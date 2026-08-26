import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  IsDefined,
} from 'class-validator';
import { IsCedulaEcuatoriana } from 'src/common/is-cedula-ecuatoriana.validator';
import { IsCelularEcuatoriano } from 'src/common/is-celular-ecuatoriano.validator';
import { IsFechaNacimiento } from 'src/common/is-fecha-nacimiento.validator';
import {
  EstadoCivilEnum,
  EtniaEnum,
  RangoEdadEnum,
  SexoEnum,
  ZonaResidenciaEnum,
} from '../enums/perfil-usuario.enum';

export class CompletarPerfilDto {
  // ---------- Identificación ----------

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

  // ---------- Correos y nombres ----------

  @IsEmail({}, { message: 'El correo institucional no es válido.' })
  @IsOptional()
  email_institucional?: string;

  @IsEmail({}, { message: 'El correo personal no es válido.' })
  @IsOptional()
  email_personal?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  primer_nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  segundo_nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  primer_apellido?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  segundo_apellido?: string;

  // ---------- Datos personales ----------

  @IsEnum(SexoEnum, { message: 'El sexo debe ser Hombre o Mujer.' })
  @IsNotEmpty({ message: 'El sexo es obligatorio.' })
  sexo: SexoEnum;

  @IsEnum(EstadoCivilEnum, { message: 'El estado civil ingresado no es válido.' })
  @IsNotEmpty({ message: 'El estado civil es obligatorio.' })
  estado_civil: EstadoCivilEnum;

  @IsBoolean({ message: 'Indique si tiene hijos/as (true/false).' })
  @IsDefined({ message: '¿Tiene hijos/as? es obligatorio.' })
  tiene_hijos: boolean;

  @IsEnum(EtniaEnum, { message: 'La etnia/raza ingresada no es válida.' })
  @IsNotEmpty({ message: 'La etnia/raza es obligatoria.' })
  etnia: EtniaEnum;

  @IsString()
  @IsNotEmpty({ message: 'El idioma es obligatorio.' })
  @MaxLength(100)
  idioma: string;

  // 🔥 NUEVOS CAMPOS GEOGRÁFICOS VALIDADOS POR UUID
  @IsUUID('4', { message: 'El ID de la nacionalidad no es válido.' })
  @IsNotEmpty({ message: 'La nacionalidad es obligatoria.' })
  nacionalidad_id: string;

  @IsUUID('4', { message: 'El ID del país de residencia no es válido.' })
  @IsNotEmpty({ message: 'El país de residencia es obligatorio.' })
  pais_residencia_id: string;

  @IsUUID('4', { message: 'El ID de la provincia no es válido.' })
  @IsOptional()
  provincia_residencia_id?: string;

  @IsUUID('4', { message: 'El ID del cantón no es válido.' })
  @IsOptional()
  canton_residencia_id?: string;

  // Formato esperado: DD/MM/AAAA
  @IsString()
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria.' })
  @IsFechaNacimiento()
  fecha_nacimiento: string;

  @IsEnum(RangoEdadEnum, { message: 'El rango de edad ingresado no es válido.' })
  @IsNotEmpty({ message: 'El rango de edad es obligatorio.' })
  rango_edad: RangoEdadEnum;

  // Solo aplica si sexo = Mujer
  @ValidateIf((dto: CompletarPerfilDto) => dto.sexo === SexoEnum.MUJER)
  @IsBoolean({ message: 'Indique si está embarazada (true/false).' })
  @IsDefined({ message: '¿Está embarazada? es obligatorio para mujeres.' })
  esta_embarazada?: boolean;

  @IsBoolean({ message: 'Indique si tiene alguna discapacidad (true/false).' })
  @IsDefined({ message: '¿Tiene alguna discapacidad? es obligatorio.' })
  tiene_discapacidad: boolean;

  // Subpregunta
  @ValidateIf((dto: CompletarPerfilDto) => dto.tiene_discapacidad === true)
  @IsString()
  @IsNotEmpty({ message: 'El tipo de discapacidad es obligatorio si indicó que tiene una discapacidad.' })
  @MaxLength(150)
  tipo_discapacidad?: string;

  @IsString()
  @IsNotEmpty({ message: 'El número celular es obligatorio.' })
  @IsCelularEcuatoriano()
  numero_celular: string;

  @IsEnum(ZonaResidenciaEnum, { message: 'La zona de residencia debe ser Urbano o Rural.' })
  @IsNotEmpty({ message: 'La zona de residencia es obligatoria.' })
  zona_residencia: ZonaResidenciaEnum;
}