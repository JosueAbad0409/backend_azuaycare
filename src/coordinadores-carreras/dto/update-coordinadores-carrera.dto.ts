import { PartialType } from '@nestjs/mapped-types';
import { CreateCoordinadoresCarreraDto } from './create-coordinadores-carrera.dto';

export class UpdateCoordinadoresCarreraDto extends PartialType(CreateCoordinadoresCarreraDto) {}
