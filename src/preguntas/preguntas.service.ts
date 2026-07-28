import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Pregunta } from './entities/pregunta.entity';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

@Injectable()
export class PreguntasService {
  constructor(
    @InjectRepository(Pregunta)
    private readonly preguntasRepository: Repository<Pregunta>,
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
    private readonly dataSource: DataSource, 
  ) {}

  private async validarFormularioNoPublicadoPorSeccion(seccionId: string) {
    const seccion = await this.seccionesRepository.findOne({ 
      where: { id: seccionId, fecha_desactivacion: IsNull() } 
    });
    
    if (!seccion) {
      throw new NotFoundException('La sección indicada no existe.');
    }

    const formulario = await this.formulariosRepository.findOne({ 
      where: { id: seccion.formulario_id, fecha_desactivacion: IsNull() } 
    });

    if (formulario && formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales en las preguntas.');
    }
  }

  async create(createPreguntaDto: CreatePreguntaDto, usuarioId: string) {
    await this.validarFormularioNoPublicadoPorSeccion(createPreguntaDto.seccion_id);

    const nuevaPregunta = this.preguntasRepository.create({
      ...createPreguntaDto,
      creado_por: usuarioId,
    });
    return this.preguntasRepository.save(nuevaPregunta);
  }

  findAll(skip: number=0, take: number=10) {
    return this.preguntasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      relations: { tipoCampo: true },
      order: { orden: 'ASC' },
    });
  }

  async findBySeccion(seccionId: string) {
    return this.preguntasRepository.find({
      where: { seccion_id: seccionId, fecha_desactivacion: IsNull() },
      relations: { tipoCampo: true },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const pregunta = await this.preguntasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { seccion: true, tipoCampo: true },
    });
    if (!pregunta) {
      throw new NotFoundException('La pregunta solicitada no existe o fue dada de baja.');
    }
    return pregunta;
  }

  async update(id: string, updatePreguntaDto: UpdatePreguntaDto, usuarioId: string) {
    const pregunta = await this.findOne(id);
    await this.validarFormularioNoPublicadoPorSeccion(pregunta.seccion_id);

    await this.preguntasRepository.update(id, {
      ...updatePreguntaDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const pregunta = await this.findOne(id);
    await this.validarFormularioNoPublicadoPorSeccion(pregunta.seccion_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      // 1. Desactivar pregunta principal
      await queryRunner.manager.update(Pregunta, id, { fecha_desactivacion: now });
      
      // 2. Desactivar elementos hijos (opciones, filas, columnas, dependencias) usando QueryBuilder
      await queryRunner.manager.createQueryBuilder().update('opciones_pregunta').set({ fecha_desactivacion: now }).where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().update('filas_matriz').set({ fecha_desactivacion: now }).where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().update('columnas_matriz').set({ fecha_desactivacion: now }).where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().update('preguntas_dependencias').set({ fecha_desactivacion: now }).where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().update('preguntas_dependencias').set({ fecha_desactivacion: now }).where('pregunta_disparadora_id = :id', { id }).execute();

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return { message: 'Pregunta y sus dependencias eliminadas lógicamente con éxito.' };
  }
}