import { PartialType } from '@nestjs/mapped-types';
import { CreatePlantillasPdfDto } from './create-plantillas-pdf.dto';

export class UpdatePlantillasPdfDto extends PartialType(CreatePlantillasPdfDto) {}
