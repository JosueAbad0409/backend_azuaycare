import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { NivelesEconomicosService } from '../niveles-economicos/niveles-economicos.service'; 

@Injectable()
export class FichasRespondidasService {
  constructor(
    @InjectRepository(FichaRespondida)
    private readonly fichasRepository: Repository<FichaRespondida>,
    private readonly nivelesService: NivelesEconomicosService, 
  ) {}

  async create(createDto: CreateFichaRespondidaDto, usuarioId: string) {
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

    const ingresos = createDto.total_ingresos ?? 0;
    const egresos = createDto.total_egresos ?? 0;
    const balanceCalculado = ingresos - egresos;

    const nivelAsignado = await this.nivelesService.determinarNivel(balanceCalculado, createDto.periodo_id);

    const nuevaFicha = this.fichasRepository.create({
      ...createDto,
      usuario_id: usuarioId,
      estado_ficha: createDto.estado_ficha ?? 'BORRADOR',
      total_ingresos: ingresos,
      total_egresos: egresos,
      nivel_economico_id: nivelAsignado ? nivelAsignado.id : null,
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
        nivel_economico_id: true, 
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
    const fichaExistente = await this.findOne(id);
    const datosActualizar: any = { ...updateDto };

    if (updateDto.total_ingresos !== undefined || updateDto.total_egresos !== undefined) {
      const ingresos = updateDto.total_ingresos ?? fichaExistente.total_ingresos;
      const egresos = updateDto.total_egresos ?? fichaExistente.total_egresos;
      const balanceCalculado = ingresos - egresos;

      const nivelAsignado = await this.nivelesService.determinarNivel(balanceCalculado, fichaExistente.periodo_id);
      datosActualizar.nivel_economico_id = nivelAsignado ? nivelAsignado.id : null;
    }

    await this.fichasRepository.update(id, datosActualizar);
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

  async recalcularNivelSocioeconomico(id: string, totalIngresos: number, totalEgresos: number) {
    const ficha = await this.findOne(id);
    const balanceCalculado = totalIngresos - totalEgresos;

    const nivelAsignado = await this.nivelesService.determinarNivel(balanceCalculado, ficha.periodo_id);

    await this.fichasRepository.update(id, {
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      nivel_economico_id: nivelAsignado ? nivelAsignado.id : null,
    });

    return this.findOne(id);
  }
}
