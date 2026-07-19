import { PartialType } from '@nestjs/mapped-types';
import { CreateRespuestasFormularioDto } from './create-respuestas-formulario.dto';

export class UpdateRespuestasFormularioDto extends PartialType(CreateRespuestasFormularioDto) {}
