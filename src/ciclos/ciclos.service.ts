import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Ciclo } from './entities/ciclo.entity';
import { CreateCicloDto } from './dto/create-ciclo.dto';
import { UpdateCicloDto } from './dto/update-ciclo.dto';

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

  findAll() {
    return this.ciclosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      select: {
        id: true,
        nombre: true,
        carrera_id: true,
      },
      relations: { carrera: true },
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
    const datosActualizados: Partial<Ciclo> = { ...updateCicloDto };

    if (updateCicloDto.nombre) {
      datosActualizados.nombre = updateCicloDto.nombre.toUpperCase().trim();
    }

    const resultado = await this.ciclosRepository.update(id, datosActualizados);

    if (resultado.affected === 0) {
      throw new NotFoundException('El ciclo a actualizar no existe.');
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.ciclosRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('El ciclo a desactivar no existe.');
    }

    return { message: 'Ciclo desactivado con éxito.' };
  }
}