import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistorialRespuesta } from './entities/historial-respuesta.entity';
import { CreateHistorialRespuestaDto } from './dto/create-historial-respuesta.dto';

@Injectable()
export class HistorialRespuestasService {
  constructor(
    @InjectRepository(HistorialRespuesta)
    private readonly historialRepository: Repository<HistorialRespuesta>,
  ) {}

  async create(createDto: CreateHistorialRespuestaDto) {
    const nuevoHistorial = this.historialRepository.create(createDto);
    return this.historialRepository.save(nuevoHistorial);
  }

  async findByRespuesta(respuestaId: string) {
    return this.historialRepository.find({
      where: { respuesta_id: respuestaId },
      order: { created_at: 'DESC' },
      relations: { usuario: true },
    });
  }

  async findOne(id: string) {
    const historial = await this.historialRepository.findOne({
      where: { id },
      relations: { respuesta: true, usuario: true },
    });
    if (!historial) {
      throw new NotFoundException('Registro de historial de respuesta no encontrado.');
    }
    return historial;
  }
}