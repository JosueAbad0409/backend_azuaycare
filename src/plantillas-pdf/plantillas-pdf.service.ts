import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlantillaPdf } from './entities/plantillas-pdf.entity';
import { CreatePlantillaPdfDto } from './dto/create-plantillas-pdf.dto';


@Injectable()
export class PlantillasPdfService {
  constructor(
    @InjectRepository(PlantillaPdf)
    private readonly plantillaRepository: Repository<PlantillaPdf>,
  ) {}

  async upsert(createDto: CreatePlantillaPdfDto) {
    const existe = await this.plantillaRepository.findOne({ where: { formulario_id: createDto.formulario_id } });
    if (existe) {
      await this.plantillaRepository.update(existe.id, createDto);
      return this.plantillaRepository.findOne({ where: { id: existe.id } });
    }
    const nueva = this.plantillaRepository.create(createDto);
    return this.plantillaRepository.save(nueva);
  }

  async findByFormulario(formularioId: string) {
    const plantilla = await this.plantillaRepository.findOne({ where: { formulario_id: formularioId } });
    if (!plantilla) {
      // Retornamos valores por defecto si no hay plantilla configurada
      return {
        color_primario: '#003366',
        color_secundario: '#666666',
        encabezado: 'Ficha Socioeconómica',
        pie_pagina: 'Documento generado automáticamente',
        mostrar_tabla_rango: true,
        logo_url: null
      };
    }
    return plantilla;
  }
}