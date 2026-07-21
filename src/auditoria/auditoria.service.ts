import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  async create(createAuditoriaDto: CreateAuditoriaDto) {
    const nuevaAuditoria = this.auditoriaRepository.create(createAuditoriaDto);
    return this.auditoriaRepository.save(nuevaAuditoria);
  }

  findAll() {
    return this.auditoriaRepository.find({
      order: { created_at: 'DESC' },
      relations: { usuario: true },
    });
  }

  async findOne(id: string) {
    const registro = await this.auditoriaRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!registro) {
      throw new NotFoundException('El registro de auditoría no existe.');
    }
    return registro;
  }
}