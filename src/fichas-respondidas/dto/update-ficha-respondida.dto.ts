import { PartialType } from '@nestjs/mapped-types';
import { CreateFichaRespondidaDto } from './create-ficha-respondida.dto';

export class UpdateFichaRespondidaDto extends PartialType(CreateFichaRespondidaDto) {}
