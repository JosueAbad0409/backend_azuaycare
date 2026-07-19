import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Carrera } from './entities/carrera.entity';
import { CreateCarreraDto } from './dto/create-carrera.dto';
import { UpdateCarreraDto } from './dto/update-carrera.dto';

@Injectable()
export class CarrerasService {
  constructor(
    @InjectRepository(Carrera)
    private readonly carrerasRepository: Repository<Carrera>,
  ) {}

  async create(createCarreraDto: CreateCarreraDto) {
    const nombreSanitizado = createCarreraDto.nombre.toUpperCase().trim();

    const existe = await this.carrerasRepository.findOne({
      where: { nombre: nombreSanitizado },
      select: { id: true },
    });

    if (existe) {
      throw new BadRequestException('Ya existe una carrera registrada con ese nombre.');
    }

    const nuevaCarrera = this.carrerasRepository.create({
      nombre: nombreSanitizado,
    });

    return this.carrerasRepository.save(nuevaCarrera);
  }

  findAll() {
    return this.carrerasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      select: { id: true, nombre: true },
    });
  }

  async findOne(id: string) {
    const carrera = await this.carrerasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      select: { id: true, nombre: true },
    });

    if (!carrera) {
      throw new NotFoundException('La carrera solicitada no existe o está inactiva.');
    }

    return carrera;
  }

  async update(id: string, updateCarreraDto: UpdateCarreraDto) {
    const datosActualizados: Partial<Carrera> = {};

    if (updateCarreraDto.nombre) {
      datosActualizados.nombre = updateCarreraDto.nombre.toUpperCase().trim();
    }

    const resultado = await this.carrerasRepository.update(id, datosActualizados);

    if (resultado.affected === 0) {
      throw new NotFoundException('La carrera a actualizar no existe o fue dada de baja.');
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.carrerasRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('La carrera a desactivar no existe.');
    }

    return { message: 'Carrera desactivada con éxito.' };
  }
}