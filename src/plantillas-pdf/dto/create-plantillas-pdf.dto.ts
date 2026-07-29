import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePlantillaPdfDto {
    @IsUUID('4')
    @IsNotEmpty()
    formulario_id: string;

    @IsString()
    @IsOptional()
    logo_url?: string;

    @IsString()
    @IsOptional()
    color_primario?: string;

    @IsString()
    @IsOptional()
    color_secundario?: string;

    @IsString()
    @IsOptional()
    encabezado?: string;

    @IsString()
    @IsOptional()
    pie_pagina?: string;

    @IsBoolean()
    @IsOptional()
    mostrar_tabla_rango?: boolean;
}