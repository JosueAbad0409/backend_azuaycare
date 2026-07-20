import { PartialType } from '@nestjs/mapped-types';
import { CreateRespuestasMatrizDto } from './create-respuestas-matriz.dto';

export class UpdateRespuestasMatrizDto extends PartialType(CreateRespuestasMatrizDto) {}