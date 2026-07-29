import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateFichaRespondidaDto } from 'src/fichas-respondidas/dto/create-ficha-respondida.dto';

export class UpdateFichaRespondidaDto extends PartialType(CreateFichaRespondidaDto) {
    @IsString()
    @IsOptional()
    comentario?: string;
}