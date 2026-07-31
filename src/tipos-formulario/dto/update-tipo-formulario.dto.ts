import { PartialType } from '@nestjs/mapped-types';
import { CreateTipoFormularioDto } from './create-tipo-formulario.dto';

export class UpdateTipoFormularioDto extends PartialType(CreateTipoFormularioDto) {}