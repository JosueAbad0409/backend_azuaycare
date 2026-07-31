import { PartialType } from '@nestjs/mapped-types';
import { CreateFichaRespondidaDto } from './create-ficha-respondida.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFichaRespondidaDto extends PartialType(CreateFichaRespondidaDto) {

    @IsOptional()
    @IsString()
    estado_ficha?: string;

    @IsOptional()
    @IsString()
    comentario?: string;
}


