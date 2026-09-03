import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull } from 'typeorm';
import { Ciclo } from './entities/ciclo.entity';
import { CreateCicloDto } from './dto/create-ciclo.dto';
import { UpdateCicloDto } from './dto/update-ciclo.dto';
import { CicloCarrera } from './entities/ciclo-carrera.entity';

@Injectable()
export class CiclosService {
  constructor(
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
    @InjectRepository(CicloCarrera)
    private readonly ciclosCarrerasRepository: Repository<CicloCarrera>,
    private readonly dataSource: DataSource,
  ) {}

  // Lanza error si, para alguna de las carreras dadas, ya existe un ciclo activo
  // con el mismo nombre o el mismo orden (opcionalmente excluyendo un ciclo por id).
  private async validarColisiones(
    carreraIds: string[],
    nombre: string,
    orden: number,
    excluirCicloId?: string,
  ) {
    if (!carreraIds?.length) return;

    const query = this.ciclosCarrerasRepository
      .createQueryBuilder('cc')
      .innerJoin('cc.ciclo', 'ciclo')
      .where('cc.carrera_id IN (:...carreraIds)', { carreraIds })
      .andWhere('ciclo.fecha_desactivacion IS NULL')
      .andWhere('(ciclo.nombre = :nombre OR ciclo.orden = :orden)', { nombre, orden });

    if (excluirCicloId) {
      query.andWhere('ciclo.id != :excluirCicloId', { excluirCicloId });
    }

    const colision = await query.getOne();

    if (colision) {
      throw new BadRequestException('El nombre o el número de orden ya existe para alguna de las carreras seleccionadas.');
    }
  }

  async create(createCicloDto: CreateCicloDto) {
  const nombreSanitizado = createCicloDto.nombre.toUpperCase().trim();

  await this.validarColisiones(createCicloDto.carrera_ids, nombreSanitizado, createCicloDto.orden);

  // 1. Guardar y esperar a que finalice la transacción en la BD
  const cicloGuardado = await this.dataSource.transaction(async (manager) => {
    const nuevoCiclo = manager.create(Ciclo, {
      nombre: nombreSanitizado,
      orden: createCicloDto.orden,
    });
    const guardado = await manager.save(nuevoCiclo);

    const vinculos = createCicloDto.carrera_ids.map((carreraId) =>
      manager.create(CicloCarrera, { ciclo_id: guardado.id, carrera_id: carreraId }),
    );
    await manager.save(vinculos);

    return guardado;
  });

  // 2. Consultar el ciclo ya registrado fuera de la transacción
  return this.findOne(cicloGuardado.id);
}

  async findByCarrera(carreraId: string) {
    const ciclos = await this.ciclosRepository
      .createQueryBuilder('ciclo')
      .innerJoin('ciclo.ciclosCarreras', 'cc')
      .where('cc.carrera_id = :carreraId', { carreraId })
      .andWhere('ciclo.fecha_desactivacion IS NULL')
      .orderBy('ciclo.orden', 'ASC')
      .getMany();

    if (!ciclos || ciclos.length === 0) {
      throw new NotFoundException('No se encontraron ciclos para esta carrera.');
    }

    return ciclos;
  }

  findAll(skip: number = 0, take: number = 1000) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 1000);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.ciclosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      relations: { ciclosCarreras: { carrera: true } },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const ciclo = await this.ciclosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { ciclosCarreras: { carrera: true } },
    });

    if (!ciclo) {
      throw new NotFoundException('El ciclo solicitado no existe o está inactivo.');
    }

    return ciclo;
  }

  async update(id: string, updateCicloDto: UpdateCicloDto) {
    const cicloActual = await this.findOne(id);

    const carreraIdsReferencia =
      updateCicloDto.carrera_ids ?? cicloActual.ciclosCarreras.map((cc) => cc.carrera_id);
    const nombreReferencia = updateCicloDto.nombre
      ? updateCicloDto.nombre.toUpperCase().trim()
      : cicloActual.nombre;
    const ordenReferencia = updateCicloDto.orden ?? cicloActual.orden;

    if (updateCicloDto.nombre || updateCicloDto.orden || updateCicloDto.carrera_ids) {
      await this.validarColisiones(carreraIdsReferencia, nombreReferencia, ordenReferencia, id);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Ciclo, id, {
        ...(updateCicloDto.nombre && { nombre: nombreReferencia }),
        ...(updateCicloDto.orden !== undefined && { orden: updateCicloDto.orden }),
      });

      if (updateCicloDto.carrera_ids) {
        await manager.delete(CicloCarrera, { ciclo_id: id });
        const vinculos = updateCicloDto.carrera_ids.map((carreraId) =>
          manager.create(CicloCarrera, { ciclo_id: id, carrera_id: carreraId }),
        );
        await manager.save(vinculos);
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.ciclosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Ciclo desactivado con éxito.' };
  }
}
