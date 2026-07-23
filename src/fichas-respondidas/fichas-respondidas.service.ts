import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
      estado_ficha: 'BORRADOR', // Forzamos siempre a borrador en la creación
      total_ingresos: ingresos,
      total_egresos: egresos,
      balance_final: balanceCalculado,
      nivel_economico_id: nivelAsignado ? nivelAsignado.id : null,
    });

    return this.fichasRepository.save(nuevaFicha);
  }

  findAll(skip: number=0, take: number=10) {
    return this.fichasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      relations: { usuario: true, periodo: true },
      order: { created_at: 'DESC' },
    });
  }

  // Agregamos el parámetro opcional user para chequear el IDOR
  async findOne(id: string, user?: any) {
    const ficha = await this.fichasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { usuario: true, periodo: true, formulario: true },
    });

    if (!ficha) {
      throw new NotFoundException('La ficha solicitada no existe o fue dada de baja.');
    }

    // Validación de Propiedad (IDOR)
    if (user && !user.rol.includes('COORDINADOR') && ficha.usuario_id !== user.id) {
      throw new ForbiddenException('No tienes permiso sobre la ficha de otro usuario.');
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

  async update(id: string, updateDto: UpdateFichaRespondidaDto, user: any) {
    const fichaExistente = await this.findOne(id, user); // Ya valida propiedad aquí

    const esCoordinador = user.rol.includes('COORDINADOR');

    // Evita alteración de campos si ya fue enviada
    if (fichaExistente.estado_ficha !== 'BORRADOR' && !esCoordinador) {
      throw new BadRequestException('No puedes editar una ficha que ya fue enviada o validad.');
    }

    // Evita que el estudiante altere su propio estado
    if (updateDto.estado_ficha && !esCoordinador) {
      delete updateDto.estado_ficha;
    }

    const datosActualizar: Partial<FichaRespondida> = { ...updateDto };

    if (updateDto.total_ingresos !== undefined || updateDto.total_egresos !== undefined) {
      const ingresos = updateDto.total_ingresos ?? fichaExistente.total_ingresos;
      const egresos = updateDto.total_egresos ?? fichaExistente.total_egresos;
      const balanceCalculado = ingresos - egresos;

      const nivelAsignado = await this.nivelesService.determinarNivel(balanceCalculado, fichaExistente.periodo_id);
      datosActualizar.nivel_economico_id = nivelAsignado ? nivelAsignado.id : null;
    }

    await this.fichasRepository.update(id, datosActualizar);
    return this.findOne(id, user);
  }

  async remove(id: string, user: any) {
    const ficha = await this.findOne(id, user); // Ya valida propiedad aquí
    
    if (ficha.estado_ficha === 'VALIDADO' || ficha.estado_ficha === 'ENVIADO') {
      throw new BadRequestException('No se pueden eliminar fichas que ya han sido enviadas o validadas.');
    }

    await this.fichasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Ficha de respuestas dada de baja con éxito.' };
  }

  async cambiarEstado(id: string, estado: string) {
    const ficha = await this.findOne(id); // Para coordinadores
    await this.fichasRepository.update(id, { estado_ficha: estado });
    return this.findOne(id);
  }

  async recalcularNivelSocioeconomico(id: string, totalIngresos: number, totalEgresos: number) {
    // Como esto se ejecuta desde un listener interno, no pasamos el 'user' 
    const ficha = await this.findOne(id); 
    const balanceCalculado = totalIngresos - totalEgresos;

    const nivelAsignado = await this.nivelesService.determinarNivel(balanceCalculado, ficha.periodo_id);

    await this.fichasRepository.update(id, {
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      nivel_economico_id: nivelAsignado ? nivelAsignado.id : null,
      estado_ficha: 'ENVIADO', // 🔥 SOLUCIÓN 2: Transición de estado corregida
    });

    return this.findOne(id);
  }
}