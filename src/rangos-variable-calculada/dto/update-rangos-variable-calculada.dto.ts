import { PartialType } from '@nestjs/mapped-types';
import { CreateRangoVariableCalculadaDto } from './create-rangos-variable-calculada.dto';

export class UpdateRangosVariableCalculadaDto extends PartialType(CreateRangoVariableCalculadaDto) {}
