import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Pregunta } from './entities/pregunta.entity';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';
import { FilaMatriz } from '../matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from '../matrices-form/entities/columna-matriz.entity';
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
    @InjectRepository(FilaMatriz)
    private readonly filasMatrizRepository: Repository<FilaMatriz>,
    @InjectRepository(ColumnaMatriz)
    private readonly columnasMatrizRepository: Repository<ColumnaMatriz>,
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

    const preguntaGuardada = await this.preguntasRepository.save(nuevaPregunta);

    // ✅ NUEVO: Si se reciben filas en el DTO, guardarlas
    if (createPreguntaDto.filasMatriz && createPreguntaDto.filasMatriz.length > 0) {
      const filasConPreguntaId = createPreguntaDto.filasMatriz.map((fila, idx) => ({
        pregunta_id: preguntaGuardada.id,
        texto_fila: fila.texto_fila,
        orden: fila.orden || idx + 1,
        es_multiple: fila.es_multiple ?? false,
        permitir_multiple: fila.permitir_multiple ?? fila.es_multiple ?? false,
      }));

      await this.filasMatrizRepository.save(filasConPreguntaId);
    }

    // ✅ NUEVO: Si se reciben columnas en el DTO, guardarlas
    if (createPreguntaDto.columnasMatriz && createPreguntaDto.columnasMatriz.length > 0) {
      const columnasConPreguntaId = createPreguntaDto.columnasMatriz.map((col, idx) => ({
        pregunta_id: preguntaGuardada.id,
        texto_columna: col.texto_columna,
        orden: col.orden || idx + 1,
      }));

      await this.columnasMatrizRepository.save(columnasConPreguntaId);
    }

    await this.preguntasRepository.query(`
      UPDATE fichas_respondidas 
      SET estado_ficha = 'BORRADOR', cerrado_manual_por = NULL 
      WHERE formulario_id = (SELECT formulario_id FROM secciones WHERE id = $1)
      AND estado_ficha != 'BORRADOR'
      AND fecha_desactivacion IS NULL
    `, [createPreguntaDto.seccion_id]);

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
        filas: true,
        columnas: true,
      },
      order: {
        orden: 'ASC' 
      }
    });
  }

  async findOne(id: string) {
    const pregunta = await this.preguntasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { 
        seccion: true, 
        tipoCampo: true,
        filas: true,
        columnas: true,
      },
    });
    if (!pregunta) {
      throw new NotFoundException('La pregunta solicitada no existe o fue dada de baja.');
    }
    return pregunta;
  }

  async update(id: string, updatePreguntaDto: UpdatePreguntaDto, usuarioId: string) {
    const pregunta = await this.findOne(id);
    
    const seccion = await this.validarFormularioModificablePorSeccion(pregunta.seccion_id);

    if (updatePreguntaDto.categoria_financiera) {
      await this.validarCategoriaFinanciera(pregunta.seccion_id, updatePreguntaDto.categoria_financiera);
    }

    const datosAActualizar = { ...updatePreguntaDto };
    if ('fecha_desactivacion' in datosAActualizar) {
      delete (datosAActualizar as any).fecha_desactivacion;
    }

    // ✅ NUEVO: Eliminar campos de matriz que no pertenecen a Pregunta
    if ('filasMatriz' in datosAActualizar) {
      delete (datosAActualizar as any).filasMatriz;
    }
    if ('columnasMatriz' in datosAActualizar) {
      delete (datosAActualizar as any).columnasMatriz;
    }

    await this.preguntasRepository.update(id, {
      ...datosAActualizar,
      actualizado_por: usuarioId,
    });

    // ✅ NUEVO: Actualizar filas si se envían
    if (updatePreguntaDto.filasMatriz && updatePreguntaDto.filasMatriz.length > 0) {
      for (const fila of updatePreguntaDto.filasMatriz) {
        if (fila.id) {
          // Actualizar fila existente
          await this.filasMatrizRepository.update(
            { id: fila.id, pregunta_id: id },
            {
              texto_fila: fila.texto_fila,
              es_multiple: fila.es_multiple ?? false,
              permitir_multiple: fila.permitir_multiple ?? fila.es_multiple ?? false,
              orden: fila.orden || 1,
            }
          );
        } else {
          // Crear nueva fila
          await this.filasMatrizRepository.save({
            pregunta_id: id,
            texto_fila: fila.texto_fila,
            es_multiple: fila.es_multiple ?? false,
            permitir_multiple: fila.permitir_multiple ?? fila.es_multiple ?? false,
            orden: fila.orden || 1,
          });
        }
      }
    }

    // ✅ NUEVO: Actualizar columnas si se envían
    if (updatePreguntaDto.columnasMatriz && updatePreguntaDto.columnasMatriz.length > 0) {
      for (const columna of updatePreguntaDto.columnasMatriz) {
        if (columna.id) {
          // Actualizar columna existente
          await this.columnasMatrizRepository.update(
            { id: columna.id, pregunta_id: id },
            {
              texto_columna: columna.texto_columna,
              orden: columna.orden || 1,
            }
          );
        } else {
          // Crear nueva columna
          await this.columnasMatrizRepository.save({
            pregunta_id: id,
            texto_columna: columna.texto_columna,
            orden: columna.orden || 1,
          });
        }
      }
    }

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
      await queryRunner.manager.createQueryBuilder().delete().from('preguntas_dependencias')
        .where('pregunta_id = :id OR pregunta_disparadora_id = :id', { id }).execute();

      await queryRunner.manager.createQueryBuilder().delete().from('opciones_pregunta').where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().delete().from('filas_matriz').where('pregunta_id = :id', { id }).execute();
      await queryRunner.manager.createQueryBuilder().delete().from('columnas_matriz').where('pregunta_id = :id', { id }).execute();

      await queryRunner.manager.delete(Pregunta, id);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
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