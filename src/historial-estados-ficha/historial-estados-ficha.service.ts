import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistorialEstadosFicha } from './entities/historial-estados-ficha.entity';
import { CreateHistorialEstadosFichaDto } from './dto/create-historial-estados-ficha.dto';

@Injectable()
export class HistorialEstadosFichaService {
  constructor(
    @InjectRepository(HistorialEstadosFicha)
    private readonly historialRepository: Repository<HistorialEstadosFicha>,
  ) {}

  async create(createDto: CreateHistorialEstadosFichaDto) {
    const nuevoHistorial = this.historialRepository.create(createDto);
    return this.historialRepository.save(nuevoHistorial);
  }

  async findByFicha(fichaId: string) {
    return this.historialRepository.find({
      where: { ficha_id: fichaId },
      order: { created_at: 'DESC' },
      relations: { usuario: true },
    });
  }

  async findOne(id: string) {
    const historial = await this.historialRepository.findOne({
      where: { id },
      relations: { ficha: true, usuario: true },
    });
    if (!historial) {
      throw new NotFoundException('Registro de historial no encontrado.');
    }
    return historial;
  }
}