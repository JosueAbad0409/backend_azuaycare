import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Formulario } from '../formularios/entities/formulario.entity';
import { RangoVariableCalculada } from './entities/rangos-variable-calculada.entity';
import { CreateRangoVariableCalculadaDto, SimularRangoDto } from './dto/create-rangos-variable-calculada.dto';

@Injectable()
export class RangosVariableCalculadaService {
  constructor(
    @InjectRepository(RangoVariableCalculada)
    private readonly rangosRepository: Repository<RangoVariableCalculada>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  private async validarFormularioNoPublicado(formularioId: string) {
    const formulario = await this.formulariosRepository.findOne({
      where: { id: formularioId, fecha_desactivacion: IsNull() },
    });
    if (formulario && formulario.publicado) {
      throw new BadRequestException(
        'El formulario ya está publicado. No se pueden modificar sus rangos calculados.',
      );
    }
  }

  /** Normaliza y valida min/max */
  private normalizarYValidarLimites(valorMin: number, valorMax: number) {
    const min = Number(valorMin);
    const max = Number(valorMax);

    if (Number.isNaN(min) || Number.isNaN(max)) {
      throw new BadRequestException('valor_min y valor_max deben ser números válidos.');
    }
    if (min > max) {
      throw new BadRequestException('valor_min no puede ser mayor que valor_max.');
    }
    return { min, max };
  }

  /**
   * Impide solapes y nombres repetidos en el mismo formulario + variable_calculo.
   * excludeId: al actualizar, ignorar el propio registro.
   */
  private async validarSinConflictos(params: {
    formularioId: string;
    variableCalculo: string;
    nombre: string;
    valorMin: number;
    valorMax: number;
    excludeId?: string;
  }) {
    const { formularioId, variableCalculo, nombre, valorMin, valorMax, excludeId } = params;

    const existentes = await this.rangosRepository.find({
      where: {
        formulario_id: formularioId,
        variable_calculo: variableCalculo,
        fecha_desactivacion: IsNull(),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      order: { orden: 'ASC' },
    });

    const nombreNorm = nombre.trim().toLowerCase();

    for (const r of existentes) {
      // Nombre duplicado
      if (r.nombre.trim().toLowerCase() === nombreNorm) {
        throw new BadRequestException(
          `Ya existe un rango con el nombre "${r.nombre}" para esta variable.`,
        );
      }

      const rMin = Number(r.valor_min);
      const rMax = Number(r.valor_max);

      // Solape de intervalos [min, max]
      // Se solapan si: valorMin <= rMax && valorMax >= rMin
      const seSolapan = valorMin <= rMax && valorMax >= rMin;
      if (seSolapan) {
        throw new BadRequestException(
          `El rango [${valorMin} – ${valorMax}] se solapa con "${r.nombre}" [${rMin} – ${rMax}]. ` +
            `Los intervalos no pueden repetir ni cruzar números.`,
        );
      }
    }
  }

  async create(createDto: CreateRangoVariableCalculadaDto) {
    await this.validarFormularioNoPublicado(createDto.formulario_id);

    const { min, max } = this.normalizarYValidarLimites(
      createDto.valor_min,
      createDto.valor_max,
    );

    await this.validarSinConflictos({
      formularioId: createDto.formulario_id,
      variableCalculo: createDto.variable_calculo,
      nombre: createDto.nombre,
      valorMin: min,
      valorMax: max,
    });

    const nuevo = this.rangosRepository.create({
      ...createDto,
      nombre: createDto.nombre.trim(),
      valor_min: min,
      valor_max: max,
    });

    return this.rangosRepository.save(nuevo);
  }

  async findByFormulario(formularioId: string) {
    return this.rangosRepository.find({
      where: { formulario_id: formularioId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async update(id: string, updateDto: Partial<CreateRangoVariableCalculadaDto>) {
    const rango = await this.rangosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    if (!rango) {
      throw new NotFoundException('Rango no encontrado.');
    }

    await this.validarFormularioNoPublicado(rango.formulario_id);

    const { formulario_id, ...datos } = updateDto as any;

    const nombreFinal = (datos.nombre ?? rango.nombre).trim();
    const variableFinal = datos.variable_calculo ?? rango.variable_calculo;
    const minRaw = datos.valor_min !== undefined ? datos.valor_min : rango.valor_min;
    const maxRaw = datos.valor_max !== undefined ? datos.valor_max : rango.valor_max;

    const { min, max } = this.normalizarYValidarLimites(minRaw, maxRaw);

    await this.validarSinConflictos({
      formularioId: rango.formulario_id,
      variableCalculo: variableFinal,
      nombre: nombreFinal,
      valorMin: min,
      valorMax: max,
      excludeId: id,
    });

    await this.rangosRepository.update(id, {
      ...datos,
      nombre: nombreFinal,
      variable_calculo: variableFinal,
      valor_min: min,
      valor_max: max,
    });

    return this.rangosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
  }

  async remove(id: string) {
    const rango = await this.rangosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    if (!rango) throw new NotFoundException('Rango no encontrado.');
    await this.validarFormularioNoPublicado(rango.formulario_id);

    await this.rangosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Rango eliminado con éxito.' };
  }

  async simularRango(simularDto: SimularRangoDto) {
    const rango = await this.rangosRepository
      .createQueryBuilder('r')
      .where('r.formulario_id = :formId', { formId: simularDto.formulario_id })
      .andWhere('r.variable_calculo = :var', { var: simularDto.variable_calculo })
      .andWhere(':valor >= r.valor_min', { valor: simularDto.valor_prueba })
      .andWhere(':valor <= r.valor_max', { valor: simularDto.valor_prueba })
      .andWhere('r.fecha_desactivacion IS NULL')
      .getOne();

    if (!rango) {
      return {
        asignado: false,
        message: 'El valor de prueba no cae en ningún rango configurado.',
      };
    }
    return { asignado: true, rango };
  }
}