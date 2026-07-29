import { PartialType } from '@nestjs/mapped-types';
import { CreatePlantillaPdfDto } from './create-plantillas-pdf.dto';

export class UpdatePlantillasPdfDto extends PartialType(CreatePlantillaPdfDto) {}
