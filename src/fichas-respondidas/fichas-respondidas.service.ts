import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';

@Injectable()
export class FichasRespondidasService {
  constructor(
    @InjectRepository(FichaRespondida)
    private readonly fichasRepository: Repository<FichaRespondida>,
  ) {}

  async create(createDto: CreateFichaRespondidaDto, usuarioId: string) {
    // Rendimiento: Comprobar selectivamente si el usuario ya inició una ficha en este periodo
    const existeFicha = await this.fichasRepository.findOne({
      where: {
        usuario_id: usuarioId,
        periodo_id: createDto.periodo_id,
        fecha_desactivacion: IsNull(),
      },
      select: { id: true, estado_ficha: true },
    });

    if (existeFicha) {
      throw new BadRequestException(
        `Ya tienes una ficha registrada en este periodo de matrícula en estado: ${existeFicha.estado_ficha}.`,
      );
    }

    const nuevaFicha = this.fichasRepository.create({
      ...createDto,
      usuario_id: usuarioId,
      estado_ficha: createDto.estado_ficha ?? 'BORRADOR',
    });

    return this.fichasRepository.save(nuevaFicha);
  }

  findAll() {
    return this.fichasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      select: {
        id: true,
        usuario_id: true,
        periodo_id: true,
        formulario_id: true,
        total_ingresos: true,
        total_egresos: true,
        balance_final: true,
        estado_ficha: true,
      },
      relations: { usuario: true, periodo: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const ficha = await this.fichasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { usuario: true, periodo: true, formulario: true },
    });

    if (!ficha) {
      throw new NotFoundException('La ficha solicitada no existe o fue dada de baja.');
    }

    return ficha;
  }

  async findByUsuario(usuarioId: string) {
    return this.fichasRepository.find({
      where: { usuario_id: usuarioId, fecha_desactivacion: IsNull() },
      relations: { periodo: true, formulario: true },
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, updateDto: UpdateFichaRespondidaDto) {
    await this.findOne(id);
    await this.fichasRepository.update(id, updateDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const ficha = await this.findOne(id);
    
    if (ficha.estado_ficha === 'VALIDADO' || ficha.estado_ficha === 'ENVIADO') {
      throw new BadRequestException('No se pueden eliminar fichas que ya han sido enviadas o validadas.');
    }

    await this.fichasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Ficha de respuestas dada de baja con éxito.' };
  }
}