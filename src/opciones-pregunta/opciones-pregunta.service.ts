import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { OpcionPregunta } from './entities/opciones-pregunta.entity'; 
import { CreateOpcionPreguntaDto } from './dto/create-opciones-pregunta.dto'; 
import { UpdateOpcionPreguntaDto } from './dto/update-opciones-pregunta.dto'; 

@Injectable()
export class OpcionesPreguntaService {
  constructor(
    @InjectRepository(OpcionPregunta)
    private readonly opcionesRepository: Repository<OpcionPregunta>,
  ) {}

  async create(createOpcionPreguntaDto: CreateOpcionPreguntaDto, usuarioId: string) {
    const nuevaOpcion = this.opcionesRepository.create({
      ...createOpcionPreguntaDto,
      creado_por: usuarioId,
    });
    return this.opcionesRepository.save(nuevaOpcion);
  }

  findAll() {
    return this.opcionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findByPregunta(preguntaId: string) {
    return this.opcionesRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const opcion = await this.opcionesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    if (!opcion) {
      throw new NotFoundException('La opción solicitada no existe o está inactiva.');
    }
    return opcion;
  }

  async update(id: string, updateOpcionPreguntaDto: UpdateOpcionPreguntaDto, usuarioId: string) {
    await this.findOne(id);
    await this.opcionesRepository.update(id, {
      ...updateOpcionPreguntaDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.opcionesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Opción dada de baja con éxito.' };
  }
}