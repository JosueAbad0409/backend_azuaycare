import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Pregunta } from './entities/pregunta.entity';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';
import { FormularioCacheService } from '../common/cache/formulario-cache.service';

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
    private readonly formularioCacheService: FormularioCacheService,
  ) { }

  private async validarFormularioModificablePorSeccion(seccionId: string) {
    const seccion = await this.seccionesRepository.findOne({
      where: { id: seccionId, fecha_desactivacion: IsNull() }
    });

    if (!seccion) throw new NotFoundException('La sección indicada no existe.');

    const formulario = await this.formulariosRepository.findOne({
      where: { id: seccion.formulario_id, fecha_desactivacion: IsNull() }
    });

    if (formulario && (formulario.publicado || formulario.bloqueado)) {
      throw new BadRequestException('El formulario está congelado (publicado o bloqueado). No se permiten modificaciones estructurales.');
    }

    return seccion;
  }

  private async validarCategoriaFinanciera(seccionId: string, categoriaFinanciera?: string) {
    const seccion = await this.seccionesRepository.findOne({
      where: { id: seccionId, fecha_desactivacion: IsNull() }
    });

    if (!seccion) return;

    const categoria = categoriaFinanciera || 'NINGUNO';

    if (seccion.tipo_seccion === 'FINANCIERA' && categoria === 'NINGUNO') {
      throw new BadRequestException('En una sección FINANCIERA, la categoría financiera debe ser INGRESO o EGRESO.');
    }

    if (seccion.tipo_seccion === 'INFORMACION_GENERAL' && (categoria === 'INGRESO' || categoria === 'EGRESO')) {
      throw new BadRequestException('En una sección INFORMACION_GENERAL, la categoría financiera no puede ser INGRESO ni EGRESO.');
    }
  }

  async create(createPreguntaDto: CreatePreguntaDto, usuarioId: string) {
    const seccion = await this.validarFormularioModificablePorSeccion(createPreguntaDto.seccion_id);
    await this.validarCategoriaFinanciera(createPreguntaDto.seccion_id, createPreguntaDto.categoria_financiera);

    const nuevaPregunta = this.preguntasRepository.create({
      ...createPreguntaDto,
      creado_por: usuarioId,
    });

    await this.preguntasRepository.query(`
      UPDATE fichas_respondidas 
      SET estado_ficha = 'BORRADOR', cerrado_manual_por = NULL 
      WHERE formulario_id = (SELECT formulario_id FROM secciones WHERE id = $1)
      AND estado_ficha != 'BORRADOR'
      AND fecha_desactivacion IS NULL
    `, [createPreguntaDto.seccion_id]);

    const preguntaGuardada = await this.preguntasRepository.save(nuevaPregunta);

    await this.formularioCacheService.invalidarPorFormularioId(seccion.formulario_id);

    return preguntaGuardada;
  }

  findAll(skip: number = 0, take: number = 10) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.preguntasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      relations: { tipoCampo: true },
      order: { orden: 'ASC' },
    });
  }

  async findBySeccion(seccionId: string) {
    return this.preguntasRepository.find({
      where: {
        seccion_id: seccionId,
        fecha_desactivacion: IsNull()
      },
      relations: {
        tipoCampo: true,
        opciones: true,
      },
      order: {
        orden: 'ASC' 
      }
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
    
    // Si está publicado, esto bloqueará la edición.
    const seccion = await this.validarFormularioModificablePorSeccion(pregunta.seccion_id);

    if (updatePreguntaDto.categoria_financiera) {
      await this.validarCategoriaFinanciera(pregunta.seccion_id, updatePreguntaDto.categoria_financiera);
    }

    // SEGURIDAD: Evitamos que usen el UPDATE para desactivar lógicamente la pregunta
    const datosAActualizar = { ...updatePreguntaDto };
    if ('fecha_desactivacion' in datosAActualizar) {
      delete (datosAActualizar as any).fecha_desactivacion;
    }

    await this.preguntasRepository.update(id, {
      ...datosAActualizar,
      actualizado_por: usuarioId,
    });

    await this.preguntasRepository.query(`
      UPDATE fichas_respondidas 
      SET estado_ficha = 'BORRADOR', cerrado_manual_por = NULL 
      WHERE formulario_id = (SELECT formulario_id FROM secciones WHERE id = (SELECT seccion_id FROM preguntas WHERE id = $1))
      AND estado_ficha != 'BORRADOR'
      AND fecha_desactivacion IS NULL
    `, [id]);

    await this.formularioCacheService.invalidarPorFormularioId(seccion.formulario_id);

    return this.findOne(id);
  }

  async reordenar(seccion_id: string, ordenes: { id: string; orden: number }[]) {
    const seccion = await this.validarFormularioModificablePorSeccion(seccion_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of ordenes) {
        await queryRunner.manager.update(Pregunta, { id: item.id, seccion_id }, { orden: item.orden });
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.formularioCacheService.invalidarPorFormularioId(seccion.formulario_id);

    return { message: 'Preguntas reordenadas con éxito.' };
  }

  async remove(id: string) {
    const pregunta = await this.findOne(id);
    const seccion = await this.validarFormularioModificablePorSeccion(pregunta.seccion_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Eliminar dependencias donde la pregunta es el objetivo o la disparadora
      await queryRunner.manager.createQueryBuilder().delete().from('preguntas_dependencias')
        .where('pregunta_id = :id OR pregunta_disparadora_id = :id', { id }).execute();

      // Eliminar sub-elementos físicos
      await queryRunner.manager.createQueryBuilder().delete().from('opciones_pregunta').where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().delete().from('filas_matriz').where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().delete().from('columnas_matriz').where('pregunta_id = :id', { id }).execute();

      // Eliminar la pregunta
      await queryRunner.manager.delete(Pregunta, id);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Si falla, es porque una tabla externa (ej. respuestas) depende de esta pregunta
      throw new BadRequestException(
        'No se puede eliminar esta pregunta de la base de datos. Es posible que estudiantes ya hayan enviado respuestas atadas a esta pregunta.'
      );
    } finally {
      await queryRunner.release();
    }

    await this.formularioCacheService.invalidarPorFormularioId(seccion.formulario_id);

    return { message: 'Pregunta eliminada permanentemente con éxito.' };
  }
}