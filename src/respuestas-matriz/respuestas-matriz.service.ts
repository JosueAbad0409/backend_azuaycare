import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RespuestasMatriz } from './entities/respuestas-matriz.entity';
import { CreateRespuestasMatrizDto } from './dto/create-respuestas-matriz.dto';

@Injectable()
export class RespuestasMatrizService {
  constructor(
    @InjectRepository(RespuestasMatriz)
    private readonly respuestasMatrizRepository: Repository<RespuestasMatriz>,
  ) {}

  async create(createDto: CreateRespuestasMatrizDto | CreateRespuestasMatrizDto[]) {
    if (Array.isArray(createDto)) {
      const nuevasRespuestas = this.respuestasMatrizRepository.create(createDto);
      return this.respuestasMatrizRepository.save(nuevasRespuestas);
    }

    const nuevaRespuestaMatriz = this.respuestasMatrizRepository.create(createDto);
    return this.respuestasMatrizRepository.save(nuevaRespuestaMatriz);
  }

  async findByRespuesta(respuestaId: string) {
    return this.respuestasMatrizRepository.find({
      where: { respuesta_id: respuestaId },
      relations: { fila: true, columna: true },
    });
  }

  async findOne(id: string) {
    const respuestaMatriz = await this.respuestasMatrizRepository.findOne({
      where: { id },
      relations: { respuesta: true, fila: true, columna: true },
    });
    
    if (!respuestaMatriz) {
      throw new NotFoundException('Respuesta de matriz no encontrada.');
    }
    return respuestaMatriz;
  }

  async update(id: string, updateDto: Partial<CreateRespuestasMatrizDto>) {
    await this.findOne(id);
    await this.respuestasMatrizRepository.update(id, updateDto);
    return this.findOne(id);
  }
}