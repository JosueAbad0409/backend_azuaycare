import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Pregunta } from './entities/pregunta.entity';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';

@Injectable()
export class PreguntasService {
  constructor(
    @InjectRepository(Pregunta)
    private readonly preguntasRepository: Repository<Pregunta>,
  ) {}

  async create(createPreguntaDto: CreatePreguntaDto, usuarioId: string) {
    const nuevaPregunta = this.preguntasRepository.create({
      ...createPreguntaDto,
      creado_por: usuarioId,
    });
    return this.preguntasRepository.save(nuevaPregunta);
  }

  findAll(skip: number=0, take: number=10) {
    return this.preguntasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      relations: { tipoCampo: true },
      order: { orden: 'ASC' },
    });
  }

  async findBySeccion(seccionId: string) {
    return this.preguntasRepository.find({
      where: { seccion_id: seccionId, fecha_desactivacion: IsNull() },
      relations: { tipoCampo: true },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const pregunta = await this.preguntasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { seccion: true, tipoCampo: true },
    });
    if (!pregunta) {
      throw new NotFoundException('La pregunta solicitada no existe o fue dada de baja.');
    }
    return pregunta;
  }

  async update(id: string, updatePreguntaDto: UpdatePreguntaDto, usuarioId: string) {
    await this.findOne(id);
    await this.preguntasRepository.update(id, {
      ...updatePreguntaDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.preguntasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Pregunta eliminada lógicamente con éxito.' };
  }
}