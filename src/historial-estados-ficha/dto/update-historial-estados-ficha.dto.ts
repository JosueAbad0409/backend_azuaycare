import { PartialType } from '@nestjs/mapped-types';
import { CreateHistorialEstadosFichaDto } from './create-historial-estados-ficha.dto';

export class UpdateHistorialEstadosFichaDto extends PartialType(CreateHistorialEstadosFichaDto) {}