import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Formulario } from './entities/formulario.entity';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { Pregunta } from 'src/preguntas/entities/pregunta.entity';
import { OpcionPregunta } from 'src/opciones-pregunta/entities/opciones-pregunta.entity';
import { FilaMatriz } from 'src/matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from 'src/matrices-form/entities/columna-matriz.entity';
import { PreguntaDependencia } from 'src/preguntas-dependencias/entities/pregunta-dependencia.entity';
import { TipoFormulario } from 'src/tipos-formulario/entities/tipo-formulario.entity';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';

@Injectable()
export class FormulariosService {
  constructor(
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
    @InjectRepository(TipoFormulario)
    private readonly tiposFormularioRepository: Repository<TipoFormulario>,
    private readonly dataSource: DataSource,
  ) { }

  async create(createFormularioDto: CreateFormularioDto, usuarioId: string) {
    if (!createFormularioDto.tipo_formulario_id) {
      throw new BadRequestException('El tipo de formulario es obligatorio.');
    }

    // 1. Validar que el tipo de formulario exista y esté activo.
    const tipoFormulario = await this.tiposFormularioRepository.findOne({
      where: { id: createFormularioDto.tipo_formulario_id, fecha_desactivacion: IsNull() },
    });
    if (!tipoFormulario) {
      throw new NotFoundException('El tipo de formulario indicado no existe o está inactivo.');
    }

    // SE ELIMINÓ LA REGLA QUE BLOQUEABA MÚLTIPLES FORMULARIOS (yaExiste)
    // Ahora permite crear todos los que quieras del mismo tipo.

    const ultimaVersion = await this.formulariosRepository.findOne({
      where: { tipo_formulario_id: createFormularioDto.tipo_formulario_id, fecha_desactivacion: IsNull() },
      order: { version: 'DESC' },
      select: { version: true },
    });
    const nuevaVersion = ultimaVersion ? ultimaVersion.version + 1 : 1;

    const nuevoFormulario = this.formulariosRepository.create({
      ...createFormularioDto,
      version: nuevaVersion,
      creado_por: usuarioId,
    });
    const formularioGuardado = await this.formulariosRepository.save(nuevoFormulario);

    return this.findOne(formularioGuardado.id);
  }

findAll() {
    return this.formulariosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      relations: { periodo: true, tipoFormulario: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const formulario = await this.formulariosRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.periodo', 'periodo')
      .leftJoinAndSelect('f.tipoFormulario', 'tipoFormulario')
      .leftJoinAndSelect(
        'f.secciones',
        'secciones',
        'secciones.fecha_desactivacion IS NULL',
      )
      .leftJoinAndSelect(
        'secciones.preguntas',
        'preguntas',
        'preguntas.fecha_desactivacion IS NULL',
      )
      .leftJoinAndSelect('preguntas.tipoCampo', 'tipoCampo')
      .leftJoinAndSelect(
        'preguntas.opciones',
        'opciones',
        'opciones.fecha_desactivacion IS NULL',
      )
      .leftJoinAndSelect(
        'preguntas.filas',
        'filas',
        'filas.fecha_desactivacion IS NULL',
      )
      .leftJoinAndSelect(
        'preguntas.columnas',
        'columnas',
        'columnas.fecha_desactivacion IS NULL',
      )
      .leftJoinAndSelect(
        'preguntas.dependencias',
        'dependencias',
        'dependencias.fecha_desactivacion IS NULL',
      )
      .where('f.id = :id', { id })
      .andWhere('f.fecha_desactivacion IS NULL')
      .orderBy('secciones.orden', 'ASC')
      .addOrderBy('preguntas.orden', 'ASC')
      .addOrderBy('opciones.orden', 'ASC')
      .getOne();

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    return formulario;
  }

  async publicarFormulario(id: string) {
    const formulario = await this.findOne(id); // ya filtra desactivados

    if (formulario.publicado) {
      throw new BadRequestException('Este formulario ya se encuentra publicado.');
    }

    if (!formulario.secciones || formulario.secciones.length === 0) {
      throw new BadRequestException('No se puede publicar un formulario sin secciones estructuradas.');
    }

    const tienePreguntas = formulario.secciones.some(
      (s) => s.preguntas && s.preguntas.length > 0,
    );
    if (!tienePreguntas) {
      throw new BadRequestException(
        'No se puede publicar un formulario sin al menos una pregunta dentro de sus secciones.',
      );
    }

    await this.formulariosRepository.update(id, {
      publicado: true,
      fecha_publicacion: new Date(),
    });
    return this.findOne(id);
  }

  async despublicarFormulario(id: string): Promise<Formulario> {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario no existe o está inactivo.');
    }

    if (!formulario.publicado) {
      throw new BadRequestException('El formulario ya se encuentra en borrador.');
    }

    await this.formulariosRepository.update(id, { publicado: false });
    return this.findOne(id);
  }

  async update(id: string, updateFormularioDto: UpdateFormularioDto) {
    const formulario = await this.findOne(id);


    if (formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales.');
    }

    if (updateFormularioDto.tipo_formulario_id && updateFormularioDto.tipo_formulario_id !== formulario.tipo_formulario_id) {
      throw new BadRequestException('No se puede cambiar el tipo de un formulario después de haberlo creado.');
    }

    await this.formulariosRepository.update(id, updateFormularioDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const formulario = await this.findOne(id);


    if (formulario.publicado) {
      throw new BadRequestException('No se puede eliminar un formulario que ya ha sido publicado formalmente.');
    }

    await this.formulariosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Formulario dado de baja con éxito.' };
  }

  async clonarAFormularioBorrador(formularioOrigenId: string, nuevoPeriodoId: string, usuarioId: string): Promise<Formulario> {
    const formularioOrigen = await this.formulariosRepository.findOne({
      where: { id: formularioOrigenId, fecha_desactivacion: IsNull() },
      relations: {
        periodo: true,
        secciones: {
          preguntas: { opciones: true, filas: true, columnas: true, dependencias: true },
        },
      },
    });

    if (!formularioOrigen) {
      throw new NotFoundException('El formulario origen no existe o está inactivo.');
    }

    if (!formularioOrigen.tipo_formulario_id) {
      throw new BadRequestException('El formulario de origen no tiene asignado un tipo válido.');
    }

    const versionesExistentes = await this.formulariosRepository.find({
      where: { tipo_formulario_id: formularioOrigen.tipo_formulario_id, fecha_desactivacion: IsNull() },
      order: { version: 'ASC' },
    });

    const nuevaVersionNumero = versionesExistentes.length > 0
      ? versionesExistentes[versionesExistentes.length - 1].version + 1
      : 1;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Cargar periodo destino para usarlo en el título
    const periodoDestino = await queryRunner.manager.findOne(PeriodoMatricula, {
      where: { id: nuevoPeriodoId },
    });
    if (!periodoDestino) {
      throw new NotFoundException('El periodo destino no existe.');
    }

    // Quitar posibles "(v2)", "(v3)" viejos del título
    const tituloBase = formularioOrigen.titulo
      .replace(/\s*\(v\d+\)\s*$/i, '')
      .trim();

    const nuevoTitulo = `${tituloBase} - ${periodoDestino.nombre}`;

    try {
      if (versionesExistentes.length >= 2) {
        const aDesactivar = versionesExistentes.slice(0, versionesExistentes.length - 1);
        for (const formularioViejo of aDesactivar) {
          await queryRunner.manager.update(Formulario, formularioViejo.id, {
            fecha_desactivacion: new Date(),
          });
        }
      }

      const nuevoFormulario = queryRunner.manager.create(Formulario, {
        titulo: nuevoTitulo,
        descripcion: formularioOrigen.descripcion,
        tipo_formulario_id: formularioOrigen.tipo_formulario_id,
        periodo_id: nuevoPeriodoId,
        periodo_origen_id: formularioOrigen.id,
        dias_plazo_modificacion: formularioOrigen.dias_plazo_modificacion,
        version: nuevaVersionNumero,
        publicado: false,
        bloqueado: false,
        creado_por: usuarioId,
      });
      const formularioClonado = await queryRunner.manager.save(Formulario, nuevoFormulario);

      const mapaIdsViejosANuevos = new Map<string, string>();
      const dependenciasAClonar: { original: PreguntaDependencia; nuevaPreguntaId: string }[] = [];

      for (const seccionOrigen of formularioOrigen.secciones || []) {
        if (seccionOrigen.fecha_desactivacion) continue;

        const nuevaSeccion = queryRunner.manager.create(Seccion, {
          formulario_id: formularioClonado.id,
          nombre: seccionOrigen.nombre,
          orden: seccionOrigen.orden,
          tipo_seccion: seccionOrigen.tipo_seccion,
          subcategoria_financiera: seccionOrigen.subcategoria_financiera,
          creado_por: usuarioId,
        });
        const seccionClonada = await queryRunner.manager.save(Seccion, nuevaSeccion);

        for (const preguntaOrigen of seccionOrigen.preguntas || []) {
          if (preguntaOrigen.fecha_desactivacion) continue;

          const nuevaPregunta = queryRunner.manager.create(Pregunta, {
            seccion_id: seccionClonada.id,
            enunciado: preguntaOrigen.enunciado,
            tipo_campo_id: preguntaOrigen.tipo_campo_id,
            categoria_financiera: preguntaOrigen.categoria_financiera,
            variable_calculo: preguntaOrigen.variable_calculo,
            es_obligatorio: preguntaOrigen.es_obligatorio,
            orden: preguntaOrigen.orden,
            codigo_sistema: preguntaOrigen.codigo_sistema,
            requiere_evidencia: preguntaOrigen.requiere_evidencia,
            revision_manual_obligatoria: preguntaOrigen.revision_manual_obligatoria,
            creado_por: usuarioId,
          });
          const preguntaClonada = await queryRunner.manager.save(Pregunta, nuevaPregunta);
          mapaIdsViejosANuevos.set(preguntaOrigen.id, preguntaClonada.id);

          for (const opcionOrigen of preguntaOrigen.opciones || []) {
            if ((opcionOrigen as any).fecha_desactivacion) continue;
            const nuevaOpcion = queryRunner.manager.create(OpcionPregunta, {
              pregunta_id: preguntaClonada.id,
              texto_opcion: (opcionOrigen as any).texto_opcion,
              orden: (opcionOrigen as any).orden,
              creado_por: usuarioId,
              ...((opcionOrigen as any).valor_ponderado !== undefined && {
                valor_ponderado: (opcionOrigen as any).valor_ponderado,
              }),
            } as any);
            const opcionClonada = await queryRunner.manager.save(OpcionPregunta, nuevaOpcion);
            mapaIdsViejosANuevos.set(opcionOrigen.id, opcionClonada.id);
          }

          for (const filaOrigen of preguntaOrigen.filas || []) {
            if ((filaOrigen as any).fecha_desactivacion) continue;
            const nuevaFila = queryRunner.manager.create(FilaMatriz, {
              pregunta_id: preguntaClonada.id,
              texto_fila: (filaOrigen as any).texto_fila,
              orden: (filaOrigen as any).orden,
              creado_por: usuarioId,
            } as any);
            await queryRunner.manager.save(FilaMatriz, nuevaFila);
          }

          for (const colOrigen of preguntaOrigen.columnas || []) {
            if ((colOrigen as any).fecha_desactivacion) continue;
            const nuevaColumna = queryRunner.manager.create(ColumnaMatriz, {
              pregunta_id: preguntaClonada.id,
              texto_columna: (colOrigen as any).texto_columna,
              orden: (colOrigen as any).orden,
              creado_por: usuarioId,
              ...((colOrigen as any).tipo_campo_id && { tipo_campo_id: (colOrigen as any).tipo_campo_id }),
            } as any);
            await queryRunner.manager.save(ColumnaMatriz, nuevaColumna);
          }

          for (const depOrigen of preguntaOrigen.dependencias || []) {
            if (depOrigen.fecha_desactivacion) continue;
            dependenciasAClonar.push({ original: depOrigen, nuevaPreguntaId: preguntaClonada.id });
          }
        }
      }

      for (const itemDep of dependenciasAClonar) {
        const dep = itemDep.original;
        const nuevaPreguntaDisparadoraId = mapaIdsViejosANuevos.get(dep.pregunta_disparadora_id);
        const nuevaOpcionDisparadoraId = dep.opcion_disparadora_id
          ? mapaIdsViejosANuevos.get(dep.opcion_disparadora_id)
          : null;

        if (nuevaPreguntaDisparadoraId) {
          const nuevaDependencia = queryRunner.manager.create(PreguntaDependencia, {
            pregunta_id: itemDep.nuevaPreguntaId,
            pregunta_disparadora_id: nuevaPreguntaDisparadoraId,
            opcion_disparadora_id: nuevaOpcionDisparadoraId || null,
            valor_disparador: dep.valor_disparador,
          });
          await queryRunner.manager.save(PreguntaDependencia, nuevaDependencia);
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(formularioClonado.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}