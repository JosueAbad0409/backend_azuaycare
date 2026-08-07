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
    const correoSanitizado = createCarreraDto.correo_institucional.toLowerCase().trim();

    // Validar únicamente que el NOMBRE de la carrera sea único
    const existeNombre = await this.carrerasRepository.findOne({
      where: { nombre: nombreSanitizado, fecha_desactivacion: IsNull() },
      select: { id: true },
    });

    if (existeNombre) {
      throw new BadRequestException('Ya existe una carrera activa registrada con ese nombre.');
    }

    // Crear y guardar la carrera (sin restricción de correo único)
    const nuevaCarrera = this.carrerasRepository.create({
      nombre: nombreSanitizado,
      correo_institucional: correoSanitizado,
    });

    return this.carrerasRepository.save(nuevaCarrera);
  }

  findAll(skip: number = 0, take: number = 100) {
    const parsedTake = Number(take);
    const limiteReal = Math.min(Math.max(isNaN(parsedTake) ? 100 : parsedTake, 1), 1000);
    const skipReal = Math.max(Number(skip) || 0, 0);

    return this.carrerasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal, 
      select: { id: true, nombre: true, correo_institucional: true }, 
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const carrera = await this.carrerasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      select: { id: true, nombre: true, correo_institucional: true },
    });

    if (!carrera) {
      throw new NotFoundException('La carrera solicitada no existe o está inactiva.');
    }

    return carrera;
  }

  async update(id: string, updateCarreraDto: UpdateCarreraDto) {
    await this.findOne(id);
    const datosActualizados: Partial<Carrera> = {};

    // Validar colisión de nombre si se actualiza
    if (updateCarreraDto.nombre) {
      const nombreSanitizado = updateCarreraDto.nombre.toUpperCase().trim();
      
      const colisionNombre = await this.carrerasRepository.findOne({
        where: { nombre: nombreSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });

      if (colisionNombre) throw new BadRequestException('El nuevo nombre ya pertenece a otra carrera.');
      datosActualizados.nombre = nombreSanitizado;
    }

    // Se asigna el correo directamente sin verificar si otra carrera ya lo posee
    if (updateCarreraDto.correo_institucional) {
      datosActualizados.correo_institucional = updateCarreraDto.correo_institucional.toLowerCase().trim();
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