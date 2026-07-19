import { PartialType } from '@nestjs/mapped-types';
import { CreatePeriodoMatriculaDto } from './create-periodos-matricula.dto';

export class UpdatePeriodoMatriculaDto extends PartialType(CreatePeriodoMatriculaDto) {}