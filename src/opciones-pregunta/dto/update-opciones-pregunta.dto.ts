import { PartialType } from '@nestjs/mapped-types';
import { CreateOpcionPreguntaDto } from './create-opciones-pregunta.dto';

export class UpdateOpcionPreguntaDto extends PartialType(CreateOpcionPreguntaDto) {}