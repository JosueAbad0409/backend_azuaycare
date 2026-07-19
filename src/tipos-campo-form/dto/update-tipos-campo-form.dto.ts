import { PartialType } from '@nestjs/mapped-types';
import { CreateTipoCampoFormDto } from './create-tipos-campo-form.dto';

export class UpdateTipoCampoFormDto extends PartialType(CreateTipoCampoFormDto) {}