import { PartialType } from '@nestjs/mapped-types';
import { CreatePreguntaDependenciaDto } from './create-pregunta-dependencia.dto';

export class UpdatePreguntaDependenciaDto extends PartialType(CreatePreguntaDependenciaDto) {}