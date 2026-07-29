import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRangoVariableCalculadaDto {
    @IsUUID('4')
    @IsNotEmpty()
    formulario_id: string;

    @IsString()
    @IsNotEmpty()
    variable_calculo: string;

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsNumber()
    @IsNotEmpty()
    valor_min: number;

    @IsNumber()
    @IsNotEmpty()
    valor_max: number;

    @IsNumber()
    @IsOptional()
    orden?: number;
    }

    export class SimularRangoDto {
    @IsUUID('4')
    @IsNotEmpty()
    formulario_id: string;

    @IsString()
    @IsNotEmpty()
    variable_calculo: string;

    @IsNumber()
    @IsNotEmpty()
    valor_prueba: number;
}