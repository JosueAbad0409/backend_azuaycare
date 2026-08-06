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

  private async validarFormularioModificable(formularioId: string) {
    const formulario = await this.formulariosRepository.findOne({ 
      where: { id: formularioId, fecha_desactivacion: IsNull() } 
    });
    if (formulario && (formulario.publicado || formulario.bloqueado)) {
      throw new BadRequestException('El diseño del formulario está congelado (ya fue publicado o es una versión bloqueada). No se permiten modificaciones.');
    }
  }

  async create(createSeccionDto: CreateSeccionDto, usuarioId: string) {
    await this.validarFormularioModificable(createSeccionDto.formulario_id);

    const nuevaSeccion = this.seccionesRepository.create({
      ...createSeccionDto,
      creado_por: usuarioId,
    });

    // 🔥 MAGIA AUTOMÁTICA: Si se agrega una nueva sección, reabrir fichas
    await this.seccionesRepository.query(`
      UPDATE fichas_respondidas 
      SET estado_ficha = 'BORRADOR', cerrado_manual_por = NULL 
      WHERE formulario_id = $1
      AND estado_ficha != 'BORRADOR'
      AND fecha_desactivacion IS NULL
    `, [createSeccionDto.formulario_id]); // 👈 Igual, verifica que coincida con tu DTO

    return this.seccionesRepository.save(nuevaSeccion);
  }

  findAll(skip: number = 0, take: number = 10) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.seccionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
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
    await this.validarFormularioModificable(seccion.formulario_id);

    await this.seccionesRepository.update(id, {
      ...updateSeccionDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async reordenar(formulario_id: string, ordenes: { id: string; orden: number }[]) {
    await this.validarFormularioModificable(formulario_id);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of ordenes) {
        await queryRunner.manager.update(Seccion, { id: item.id, formulario_id }, { orden: item.orden });
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    return { message: 'Secciones reordenadas con éxito.' };
  }

  async remove(id: string) {
    const seccion = await this.findOne(id);
    await this.validarFormularioModificable(seccion.formulario_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener todas las preguntas asociadas a esta sección
      const preguntas = await queryRunner.manager
        .createQueryBuilder()
        .select('id')
        .from('preguntas', 'p')
        .where('seccion_id = :seccionId', { seccionId: id })
        .getRawMany();

      if (preguntas.length > 0) {
        const preguntaIds = preguntas.map(p => p.id);

        // 2. Eliminar físicamente los registros hijos de las preguntas
        await queryRunner.manager.createQueryBuilder().delete().from('opciones_pregunta').where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().delete().from('filas_matriz').where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().delete().from('columnas_matriz').where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().delete().from('preguntas_dependencias').where('pregunta_id IN (:...ids)', { ids: preguntaIds }).execute();
        await queryRunner.manager.createQueryBuilder().delete().from('preguntas_dependencias').where('pregunta_disparadora_id IN (:...ids)', { ids: preguntaIds }).execute();

        // 3. Eliminar físicamente las preguntas
        await queryRunner.manager.createQueryBuilder().delete().from('preguntas').where('seccion_id = :seccionId', { seccionId: id }).execute();
      }

      // 4. Finalmente, eliminar físicamente la sección principal
      await queryRunner.manager.delete(Seccion, id);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('No se pudo eliminar la sección por conflictos en la base de datos.');
    } finally {
      await queryRunner.release();
    }

    return { message: 'Sección y todas sus dependencias eliminadas físicamente con éxito.' };
  }
}