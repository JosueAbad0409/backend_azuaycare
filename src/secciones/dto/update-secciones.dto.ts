import { PartialType } from '@nestjs/mapped-types';
import { CreateSeccionDto } from './create-secciones.dto'; 

export class UpdateSeccionDto extends PartialType(CreateSeccionDto) {}