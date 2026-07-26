import { IsNotEmpty, IsUUID } from 'class-validator';

export class ClonarFormularioDto {
    @IsUUID('4', { message: 'El periodo_nuevo_id debe ser un UUID válido.' })
    @IsNotEmpty({ message: 'El periodo nuevo es obligatorio.' })
    periodo_nuevo_id: string;
}