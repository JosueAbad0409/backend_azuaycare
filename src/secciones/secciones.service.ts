import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Seccion } from './entities/secciones.entity';
import { CreateSeccionDto } from './dto/create-secciones.dto';
import { UpdateSeccionDto } from './dto/update-secciones.dto';
import { Formulario } from '../formularios/entities/formulario.entity'; 

@Injectable()
export class SeccionesService {
  constructor(
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
    private readonly dataSource: DataSource, 
  ) {}

  private async validarFormularioNoPublicado(formularioId: string) {
    const formulario = await this.formulariosRepository.findOne({ 
      where: { id: formularioId, fecha_desactivacion: IsNull() } 
    });
    if (formulario && formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales en las secciones.');
    }
  }

  async create(createSeccionDto: CreateSeccionDto, usuarioId: string) {
    await this.validarFormularioNoPublicado(createSeccionDto.formulario_id);

    const nuevaSeccion = this.seccionesRepository.create({
      ...createSeccionDto,
      creado_por: usuarioId,
    });
    return this.seccionesRepository.save(nuevaSeccion);
  }

  findAll(skip: number=0, take: number=10) {
    return this.seccionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      order: { orden: 'ASC' },
    });
  }

  async findByFormulario(formularioId: string) {
    return this.seccionesRepository.find({
      where: { formulario_id: formularioId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const seccion = await this.seccionesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    
    if (!seccion) {
      throw new NotFoundException('La sección solicitada no existe o está inactiva.');
    }
    return seccion;
  }

  async update(id: string, updateSeccionDto: UpdateSeccionDto, usuarioId: string) {
    const seccion = await this.findOne(id);
    await this.validarFormularioNoPublicado(seccion.formulario_id);

    await this.seccionesRepository.update(id, {
      ...updateSeccionDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const seccion = await this.findOne(id);
    await this.validarFormularioNoPublicado(seccion.formulario_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      // 1. Desactivación de la sección principal
      await queryRunner.manager.update(Seccion, id, { fecha_desactivacion: now });

      // 2. Localizar preguntas hijas usando QueryBuilder para evitar errores de tipado
      const preguntas = await queryRunner.manager
        .createQueryBuilder()
        .select('id')
        .from('preguntas', 'p')
        .where('seccion_id = :seccionId', { seccionId: id })
        .andWhere('fecha_desactivacion IS NULL')
        .getRawMany();

      if (preguntas.length > 0) {
        const preguntaIds = preguntas.map(p => p.id);

        // 3. Ejecución de cascada lógica a todas las dependencias usando QueryBuilder
        await queryRunner.manager.createQueryBuilder().update('preguntas').set({ fecha_desactivacion: now }).where('seccion_id = :seccionId', { seccionId: id }).execute();
        await queryRunner.manager.createQueryBuilder().update('opciones_pregunta').set({ fecha_desactivacion: now }).where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().update('filas_matriz').set({ fecha_desactivacion: now }).where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().update('columnas_matriz').set({ fecha_desactivacion: now }).where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().update('preguntas_dependencias').set({ fecha_desactivacion: now }).where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().update('preguntas_dependencias').set({ fecha_desactivacion: now }).where('pregunta_disparadora_id IN (:...ids)', { ids: preguntaIds }).execute();
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return { message: 'Sección y sus dependencias dadas de baja con éxito.' };
  }
}