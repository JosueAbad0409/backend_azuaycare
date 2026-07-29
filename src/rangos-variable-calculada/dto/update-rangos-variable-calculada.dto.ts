import { PartialType } from '@nestjs/mapped-types';
import { CreateRangosVariableCalculadaDto } from './create-rangos-variable-calculada.dto';

export class UpdateRangosVariableCalculadaDto extends PartialType(CreateRangosVariableCalculadaDto) {}
