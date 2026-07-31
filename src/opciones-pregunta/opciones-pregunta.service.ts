import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { OpcionPregunta } from './entities/opciones-pregunta.entity'; 
import { CreateOpcionPreguntaDto } from './dto/create-opciones-pregunta.dto'; 
import { UpdateOpcionPreguntaDto } from './dto/update-opciones-pregunta.dto'; 
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

@Injectable()
export class OpcionesPreguntaService {
  constructor(
    @InjectRepository(OpcionPregunta)
    private readonly opcionesRepository: Repository<OpcionPregunta>,
    @InjectRepository(Pregunta)
    private readonly preguntasRepository: Repository<Pregunta>,
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  private async validarFormularioModificablePorPregunta(preguntaId: string) {
    const pregunta = await this.preguntasRepository.findOne({ where: { id: preguntaId, fecha_desactivacion: IsNull() } });
    if (!pregunta) throw new NotFoundException('Pregunta no encontrada.');

    const seccion = await this.seccionesRepository.findOne({ where: { id: pregunta.seccion_id, fecha_desactivacion: IsNull() } });
    if (!seccion) throw new NotFoundException('Sección no encontrada.');

    const formulario = await this.formulariosRepository.findOne({ where: { id: seccion.formulario_id, fecha_desactivacion: IsNull() } });
    if (formulario && (formulario.publicado || formulario.bloqueado)) {
      throw new BadRequestException('El formulario está congelado (publicado o bloqueado). No se permiten modificaciones en las opciones.');
    }
  }

  async create(createOpcionPreguntaDto: CreateOpcionPreguntaDto, usuarioId: string) {
    if (createOpcionPreguntaDto.pregunta_id) {
      await this.validarFormularioModificablePorPregunta(createOpcionPreguntaDto.pregunta_id);
    }

    const nuevaOpcion = this.opcionesRepository.create({
      ...createOpcionPreguntaDto, 
      creado_por: usuarioId,
    });
    return this.opcionesRepository.save(nuevaOpcion);
  }

  findAll(skip: number = 0, take: number = 10) {
    return this.opcionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      order: { orden: 'ASC' },
    });
  }

  async findByPregunta(preguntaId: string) {
    return this.opcionesRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const opcion = await this.opcionesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    if (!opcion) {
      throw new NotFoundException('La opción solicitada no existe o está inactiva.');
    }
    return opcion;
  }

  async update(id: string, updateOpcionPreguntaDto: UpdateOpcionPreguntaDto, usuarioId: string) {
    const opcion = await this.findOne(id);
    if (opcion.pregunta_id) {
      await this.validarFormularioModificablePorPregunta(opcion.pregunta_id);
    }

    await this.opcionesRepository.update(id, {
      ...updateOpcionPreguntaDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const opcion = await this.findOne(id);
    if (opcion.pregunta_id) {
      await this.validarFormularioModificablePorPregunta(opcion.pregunta_id);
    }

    await this.opcionesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Opción dada de baja con éxito.' };
  }
}