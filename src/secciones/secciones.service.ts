import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Seccion } from './entities/secciones.entity';
import { CreateSeccionDto } from './dto/create-secciones.dto';
import { UpdateSeccionDto } from './dto/update-secciones.dto';

@Injectable()
export class SeccionesService {
  constructor(
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
  ) {}

  async create(createSeccionDto: CreateSeccionDto, usuarioId: string) {
    const nuevaSeccion = this.seccionesRepository.create({
      ...createSeccionDto,
      creado_por: usuarioId,
    });
    return this.seccionesRepository.save(nuevaSeccion);
  }

  findAll() {
    return this.seccionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findByFormulario(formularioId: string) {
    return this.seccionesRepository.find({
      where: { formulario_id: formularioId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const seccion = await this.seccionesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    
    if (!seccion) {
      throw new NotFoundException('La sección solicitada no existe o está inactiva.');
    }
    return seccion;
  }

  async update(id: string, updateSeccionDto: UpdateSeccionDto, usuarioId: string) {
    await this.findOne(id);
    await this.seccionesRepository.update(id, {
      ...updateSeccionDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.seccionesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Sección dada de baja con éxito.' };
  }
}