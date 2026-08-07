import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
      where: { id: formularioId, fecha_desactivacion: IsNull() } 
    });
    if (formulario && formulario.publicado) {
      throw new BadRequestException('El formulario ya está publicado. No se pueden modificar sus rangos calculados.');
    }
  }

  async create(createDto: CreateRangoVariableCalculadaDto) {
    await this.validarFormularioNoPublicado(createDto.formulario_id);
    const nuevo = this.rangosRepository.create(createDto);
    return this.rangosRepository.save(nuevo);
  }

  async findByFormulario(formularioId: string) {
    return this.rangosRepository.find({
      where: { formulario_id: formularioId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async remove(id: string) {
    const rango = await this.rangosRepository.findOne({ where: { id, fecha_desactivacion: IsNull() } });
    if (!rango) throw new NotFoundException('Rango no encontrado.');
    await this.validarFormularioNoPublicado(rango.formulario_id);

    await this.rangosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Rango eliminado con éxito.' };
  }

  // 🔥 Endpoint de previsualización solicitado en el 1.1
  async simularRango(simularDto: SimularRangoDto) {
    const rango = await this.rangosRepository.createQueryBuilder('r')
      .where('r.formulario_id = :formId', { formId: simularDto.formulario_id })
      .andWhere('r.variable_calculo = :var', { var: simularDto.variable_calculo })
      .andWhere(':valor >= r.valor_min', { valor: simularDto.valor_prueba })
      .andWhere(':valor <= r.valor_max', { valor: simularDto.valor_prueba })
      .andWhere('r.fecha_desactivacion IS NULL')
      .getOne();

    if (!rango) {
      return { asignado: false, message: 'El valor de prueba no cae en ningún rango configurado.' };
    }
    return { asignado: true, rango };
  }

  async update(id: string, updateDto: Partial<CreateRangoVariableCalculadaDto>) {
  const rango = await this.rangosRepository.findOne({
    where: { id, fecha_desactivacion: IsNull() },
  });
  if (!rango) {
    throw new NotFoundException('Rango no encontrado.');
  }

  await this.validarFormularioNoPublicado(rango.formulario_id);

  // No permitir cambiar el formulario al que pertenece
  const { formulario_id, ...datos } = updateDto as any;

  await this.rangosRepository.update(id, {
    ...datos,
  });

  return this.rangosRepository.findOne({
    where: { id, fecha_desactivacion: IsNull() },
  });
}
}