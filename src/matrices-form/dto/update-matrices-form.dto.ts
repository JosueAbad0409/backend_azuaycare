import { PartialType } from '@nestjs/mapped-types';
import { CreateFilaMatrizDto, CreateColumnaMatrizDto } from './create-matrices-form.dto';

export class UpdateFilaMatrizDto extends PartialType(CreateFilaMatrizDto) {}
export class UpdateColumnaMatrizDto extends PartialType(CreateColumnaMatrizDto) {}
