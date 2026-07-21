import { PartialType } from '@nestjs/mapped-types';
import { CreatePerfilCoordinadorDto } from './create-perfil-coordinador.dto';

export class UpdatePerfilCoordinadorDto extends PartialType(CreatePerfilCoordinadorDto) {}
