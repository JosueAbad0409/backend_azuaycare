import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoordinadoresCarrera } from './entities/coordinadores-carrera.entity';
import { CreateCoordinadoresCarreraDto } from './dto/create-coordinadores-carrera.dto';
import { UpdateCoordinadoresCarreraDto } from './dto/update-coordinadores-carrera.dto';

@Injectable()
export class CoordinadoresCarrerasService {
  constructor(
    @InjectRepository(CoordinadoresCarrera)
    private readonly coordinadoresRepository: Repository<CoordinadoresCarrera>,
  ) {}

  async create(createDto: CreateCoordinadoresCarreraDto) {
    const existe = await this.coordinadoresRepository.findOne({
      where: { usuario_id: createDto.usuario_id, carrera_id: createDto.carrera_id }
    });

    if (existe) {
      throw new BadRequestException('El usuario ya está asignado como coordinador a esta carrera.');
    }

    const nuevaAsignacion = this.coordinadoresRepository.create(createDto);
    return this.coordinadoresRepository.save(nuevaAsignacion);
  }

  findAll(skip: number=0, take: number=10) {
    return this.coordinadoresRepository.find({
      skip,
      take,
      order: { carrera: { nombre: 'ASC' } },
      relations: { usuario: true, carrera: true },
    });
  }

  async findOne(usuario_id: string, carrera_id: string) {
    const asignacion = await this.coordinadoresRepository.findOne({
      where: { usuario_id, carrera_id },
      relations: { usuario: true, carrera: true },
    });
    
    if (!asignacion) {
      throw new NotFoundException('Asignación no encontrada.');
    }
    return asignacion;
  }

  async update(usuario_id: string, carrera_id: string, updateDto: UpdateCoordinadoresCarreraDto) {
    await this.findOne(usuario_id, carrera_id);
    await this.coordinadoresRepository.update({ usuario_id, carrera_id }, updateDto);
    return this.findOne(usuario_id, carrera_id);
  }

  async remove(usuario_id: string, carrera_id: string) {
    await this.findOne(usuario_id, carrera_id);
    await this.coordinadoresRepository.delete({ usuario_id, carrera_id });
    return { message: 'Asignación eliminada con éxito.' };
  }
}