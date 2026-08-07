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

    // 1. Validar que no exista el nombre
    const existeNombre = await this.carrerasRepository.findOne({
      where: { nombre: nombreSanitizado, fecha_desactivacion: IsNull() },
      select: { id: true },
    });

    if (existeNombre) {
      throw new BadRequestException('Ya existe una carrera activa registrada con ese nombre.');
    }

    // 2. Validar que no exista el correo institucional
    const existeCorreo = await this.carrerasRepository.findOne({
      where: { correo_institucional: correoSanitizado, fecha_desactivacion: IsNull() },
      select: { id: true },
    });

    // 3. Crear y guardar
    const nuevaCarrera = this.carrerasRepository.create({
      nombre: nombreSanitizado,
      correo_institucional: correoSanitizado,
    });

    return this.carrerasRepository.save(nuevaCarrera);
  }

  findAll(skip: number = 0, take: number = 100) {
  const parsedTake = Number(take);
  // Si no se envía take o no es un número, usa 100. Permite desde 1 hasta 1000 registros.
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
      // Agregamos el correo al select
      select: { id: true, nombre: true, correo_institucional: true },
    });

    if (!carrera) {
      throw new NotFoundException('La carrera solicitada no existe o está inactiva.');
    }

    return carrera;
  }

  async update(id: string, updateCarreraDto: UpdateCarreraDto) {
    await this.findOne(id); // Valida que exista
    const datosActualizados: Partial<Carrera> = {};

    // Si mandan un nuevo nombre en el PATCH
    if (updateCarreraDto.nombre) {
      const nombreSanitizado = updateCarreraDto.nombre.toUpperCase().trim();
      
      const colisionNombre = await this.carrerasRepository.findOne({
        where: { nombre: nombreSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });

      if (colisionNombre) throw new BadRequestException('El nuevo nombre ya pertenece a otra carrera.');
      datosActualizados.nombre = nombreSanitizado;
    }

    // Si mandan un nuevo correo en el PATCH
    if (updateCarreraDto.correo_institucional) {
      const correoSanitizado = updateCarreraDto.correo_institucional.toLowerCase().trim();
      
      const colisionCorreo = await this.carrerasRepository.findOne({
        where: { correo_institucional: correoSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });

      if (colisionCorreo) throw new BadRequestException('El nuevo correo institucional ya pertenece a otra carrera.');
      datosActualizados.correo_institucional = correoSanitizado;
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