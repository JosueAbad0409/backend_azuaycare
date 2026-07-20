import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { NivelesEconomico } from './entities/niveles-economico.entity';
import { CreateNivelesEconomicoDto } from './dto/create-niveles-economico.dto';
import { UpdateNivelesEconomicoDto } from './dto/update-niveles-economico.dto';

@Injectable()
export class NivelesEconomicosService {
  constructor(
    @InjectRepository(NivelesEconomico)
    private readonly nivelesRepository: Repository<NivelesEconomico>,
  ) {}

  async create(createDto: CreateNivelesEconomicoDto, usuarioId: string) {
    if (createDto.valor_max && createDto.valor_min >= createDto.valor_max) {
      throw new BadRequestException('El valor mínimo no puede ser mayor o igual al valor máximo.');
    }

    const nuevoNivel = this.nivelesRepository.create({
      ...createDto,
      creado_por: usuarioId,
      nombre: createDto.nombre.toUpperCase().trim(),
    });

    return this.nivelesRepository.save(nuevoNivel);
  }

  findAll() {
    return this.nivelesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      relations: { periodo: true },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const nivel = await this.nivelesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { periodo: true },
    });

    if (!nivel) {
      throw new NotFoundException('El nivel económico solicitado no existe o está inactivo.');
    }

    return nivel;
  }

  async findByPeriodo(periodoId: string) {
    return this.nivelesRepository.find({
      where: { periodo_id: periodoId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async update(id: string, updateDto: UpdateNivelesEconomicoDto, usuarioId: string) {
    await this.findOne(id);
    const datosActualizados: Partial<NivelesEconomico> = {
      ...updateDto,
      actualizado_por: usuarioId,
    };

    if (updateDto.nombre) {
      datosActualizados.nombre = updateDto.nombre.toUpperCase().trim();
    }

    await this.nivelesRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.nivelesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Nivel económico dado de baja con éxito.' };
  }

  
  async determinarNivel(balance: number, periodoId: string): Promise<NivelesEconomico | null> {
    const niveles = await this.findByPeriodo(periodoId);

    for (const nivel of niveles) {
      const cumpleMin = balance >= nivel.valor_min;
      const cumpleMax = nivel.valor_max === null || balance <= nivel.valor_max;

      if (cumpleMin && cumpleMax) {
        return nivel;
      }
    }
    return null;
  }
}