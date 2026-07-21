import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
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
      where: { nombre: nombreSanitizado, fecha_desactivacion: IsNull() },
      select: { id: true },
    });

    if (existe) {
      throw new BadRequestException('Ya existe una carrera activa registrada con ese nombre.');
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
      order: { nombre: 'ASC' },
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
    await this.findOne(id); // Valida que exista
    const datosActualizados: Partial<Carrera> = {};

    if (updateCarreraDto.nombre) {
      const nombreSanitizado = updateCarreraDto.nombre.toUpperCase().trim();
      
      // Validar que el nuevo nombre no choque con otra carrera existente
      const colision = await this.carrerasRepository.findOne({
        where: { nombre: nombreSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });

      if (colision) throw new BadRequestException('El nuevo nombre ya pertenece a otra carrera.');
      datosActualizados.nombre = nombreSanitizado;
    }

    await this.carrerasRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.carrerasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Carrera desactivada con éxito.' };
  }
}