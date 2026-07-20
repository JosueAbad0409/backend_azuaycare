import { PartialType } from '@nestjs/mapped-types';
import { CreateHistorialRespuestaDto } from './create-historial-respuesta.dto';

export class UpdateHistorialRespuestaDto extends PartialType(CreateHistorialRespuestaDto) {}