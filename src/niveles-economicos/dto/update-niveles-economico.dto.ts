import { PartialType } from '@nestjs/mapped-types';
import { CreateNivelesEconomicoDto } from './create-niveles-economico.dto';

export class UpdateNivelesEconomicoDto extends PartialType(CreateNivelesEconomicoDto) {}