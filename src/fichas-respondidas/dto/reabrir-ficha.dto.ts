import { IsInt, IsOptional, Min } from 'class-validator';

export class ReabrirFichaDto {
    @IsInt({ message: 'Los días adicionales deben ser un número entero.' })
    @Min(1, { message: 'Debe agregar al menos 1 día adicional si desea extender la fecha.' })
    @IsOptional()
    dias_extension?: number;
}