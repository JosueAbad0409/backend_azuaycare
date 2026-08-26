import { PartialType } from '@nestjs/mapped-types';
import { CreateUbicacioneDto } from './create-ubicacione.dto';

export class UpdateUbicacioneDto extends PartialType(CreateUbicacioneDto) {}
