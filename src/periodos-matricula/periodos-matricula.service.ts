import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { PeriodoMatricula } from './entities/periodos-matricula.entity';
import { CreatePeriodoMatriculaDto } from './dto/create-periodos-matricula.dto';
import { UpdatePeriodoMatriculaDto } from './dto/update-periodos-matricula.dto'; // 👈 Corregido a singular

@Injectable()
export class PeriodosMatriculaService {
  constructor(
    @InjectRepository(PeriodoMatricula)
    private readonly periodosRepository: Repository<PeriodoMatricula>,
  ) {}

  async create(createDto: CreatePeriodoMatriculaDto) {
    if (createDto.fecha_inicio >= createDto.fecha_fin) {
      throw new BadRequestException('La fecha de inicio no puede ser mayor o igual a la fecha de fin.');
    }

    const nombreSanitizado = createDto.nombre.toUpperCase().trim();

    if (createDto.activo) {
      await this.periodosRepository.update({ activo: true }, { activo: false });
    }

    const nuevoPeriodo = this.periodosRepository.create({
      ...createDto,
      nombre: nombreSanitizado,
    });

    return this.periodosRepository.save(nuevoPeriodo);
  }

  findAll(skip: number=0, take: number=10) {
    return this.periodosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const periodo = await this.periodosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!periodo) {
      throw new NotFoundException('El periodo solicitado no existe o está inactivo.');
    }

    return periodo;
  }

  async update(id: string, updateDto: UpdatePeriodoMatriculaDto) { // 👈 Tipado corregido
    await this.findOne(id);
    const datosActualizados: Partial<PeriodoMatricula> = { ...updateDto };

    if (updateDto.nombre) {
      datosActualizados.nombre = updateDto.nombre.toUpperCase().trim();
    }

    if (updateDto.activo) {
      await this.periodosRepository.update({ id: Not(id), activo: true }, { activo: false });
    }

    await this.periodosRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    const periodo = await this.findOne(id);
    
    if (periodo.activo) {
      throw new BadRequestException('No se puede eliminar un periodo de matrícula activo.');
    }

    await this.periodosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Periodo de matrícula desactivado con éxito.' };
  }
}