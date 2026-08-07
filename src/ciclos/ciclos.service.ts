import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Ciclo } from './entities/ciclo.entity';
import { CreateCicloDto } from './dto/create-ciclo.dto';
import { UpdateCicloDto } from './dto/update-ciclo.dto'; //

@Injectable()
export class CiclosService {
  constructor(
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
  ) {}

  async create(createCicloDto: CreateCicloDto) {
    const nombreSanitizado = createCicloDto.nombre.toUpperCase().trim();

    const existe = await this.ciclosRepository.findOne({
      where: { 
        nombre: nombreSanitizado,
        carrera_id: createCicloDto.carrera_id,
        fecha_desactivacion: IsNull()
      },
      select: { id: true },
    });

    if (existe) {
      throw new BadRequestException('Este ciclo ya está registrado en la carrera seleccionada.');
    }

    const nuevoCiclo = this.ciclosRepository.create({
      ...createCicloDto,
      nombre: nombreSanitizado,
    });

    return this.ciclosRepository.save(nuevoCiclo);
  }

  // Agrégalo justo debajo de tu método findAll() o findOne()
  async findByCarrera(carreraId: string) {
    const ciclos = await this.ciclosRepository.find({
      where: { 
        carrera_id: carreraId, 
        fecha_desactivacion: IsNull() 
      },
      relations: { carrera: true },
      order: { nombre: 'ASC' },
    });

    if (!ciclos || ciclos.length === 0) {
      throw new NotFoundException('No se encontraron ciclos para esta carrera.');
    }

    return ciclos;
  }

  findAll(skip: number=0, take: number=1000) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 1000);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.ciclosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      relations: { carrera: true },
      order: { carrera_id: 'ASC', nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const ciclo = await this.ciclosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { carrera: true },
    });

    if (!ciclo) {
      throw new NotFoundException('El ciclo solicitado no existe o está inactivo.');
    }

    return ciclo;
  }

  async update(id: string, updateCicloDto: UpdateCicloDto) {
    const cicloActual = await this.findOne(id);
    const datosActualizados: Partial<Ciclo> = { ...updateCicloDto };

    if (updateCicloDto.nombre) {
      const nombreSanitizado = updateCicloDto.nombre.toUpperCase().trim();
      const carreraReferencia = updateCicloDto.carrera_id || cicloActual.carrera_id;

      const colision = await this.ciclosRepository.findOne({
        where: { nombre: nombreSanitizado, carrera_id: carreraReferencia, id: Not(id), fecha_desactivacion: IsNull() }
      });

      if (colision) throw new BadRequestException('El nombre ya existe para esa carrera.');
      datosActualizados.nombre = nombreSanitizado;
    }

    await this.ciclosRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.ciclosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Ciclo desactivado con éxito.' };
  }
}