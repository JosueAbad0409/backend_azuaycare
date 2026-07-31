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

@Injectable()
export class FormulariosService {
  constructor(
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
    @InjectRepository(TipoFormulario)
    private readonly tiposFormularioRepository: Repository<TipoFormulario>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createFormularioDto: CreateFormularioDto, usuarioId: string) {
    // 1. Validar que el tipo de formulario exista y esté activo.
    const tipoFormulario = await this.tiposFormularioRepository.findOne({
      where: { id: createFormularioDto.tipo_formulario_id, fecha_desactivacion: IsNull() },
    });
    if (!tipoFormulario) {
      throw new NotFoundException('El tipo de formulario indicado no existe o está inactivo.');
    }

    // 2. REGLA CLAVE: un solo formulario vivo por (tipo_formulario_id + periodo_id).
    const yaExiste = await this.formulariosRepository.findOne({
      where: {
        tipo_formulario_id: createFormularioDto.tipo_formulario_id,
        periodo_id: createFormularioDto.periodo_id,
        fecha_desactivacion: IsNull(),
      },
    });
    if (yaExiste) {
      throw new BadRequestException(
        `Ya existe un formulario de tipo "${tipoFormulario.nombre}" registrado para este periodo. ` +
        `Solo se permite un formulario por tipo y periodo; usa "Clonar / Nueva versión" si quieres pasarlo a otro periodo.`,
      );
    }

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

  findAll(skip: number = 0, take: number = 10) {
    return this.formulariosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      relations: { periodo: true, tipoFormulario: true }, // se agrega tipoFormulario
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: {
        periodo: true,
        tipoFormulario: true, // se agrega tipoFormulario
        secciones: {
          preguntas: {
            tipoCampo: true,
            opciones: true,
            filas: true,
            columnas: true,
            dependencias: true,
          },
        },
      },
      order: {
        secciones: {
          orden: 'ASC',
          preguntas: { orden: 'ASC', opciones: { orden: 'ASC' } },
        },
      },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    return formulario;
  }

  async publicarFormulario(id: string) {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { secciones: { preguntas: true } },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    if (formulario.bloqueado) {
      throw new BadRequestException('Este formulario es una versión anterior bloqueada; no puede publicarse.');
    }

    if (formulario.publicado) {
      throw new BadRequestException('Este formulario ya se encuentra publicado.');
    }

    if (!formulario.secciones || formulario.secciones.length === 0) {
      throw new BadRequestException('No se puede publicar un formulario sin secciones estructuradas.');
    }

    const tienePreguntas = formulario.secciones.some((s) => s.preguntas && s.preguntas.length > 0);
    if (!tienePreguntas) {
      throw new BadRequestException('No se puede publicar un formulario sin al menos una pregunta dentro de sus secciones.');
    }

    await this.formulariosRepository.update(id, { publicado: true, fecha_publicacion: new Date() });
    return this.findOne(id);
  }

  async despublicarFormulario(id: string): Promise<Formulario> {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario no existe o está inactivo.');
    }

    if (formulario.bloqueado) {
      throw new BadRequestException('Este formulario es una versión anterior bloqueada; no puede despublicarse.');
    }

    if (!formulario.publicado) {
      throw new BadRequestException('El formulario ya se encuentra en borrador.');
    }

    await this.formulariosRepository.update(id, { publicado: false });
    return this.findOne(id);
  }

  async update(id: string, updateFormularioDto: UpdateFormularioDto) {
    const formulario = await this.findOne(id);

    // ✅ NUEVO: una versión "anterior" bloqueada es de solo lectura, punto.
    if (formulario.bloqueado) {
      throw new BadRequestException(
        'Este formulario pertenece a un periodo anterior y quedó bloqueado al clonarse. Solo puede visualizarse, no editarse.',
      );
    }

    if (formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales.');
    }

    // ✅ NUEVO: no se permite reasignar el tipo de formulario después de creado
    // (evita romper la regla de "un formulario por tipo y periodo" por la puerta trasera).
    if (updateFormularioDto.tipo_formulario_id && updateFormularioDto.tipo_formulario_id !== formulario.tipo_formulario_id) {
      throw new BadRequestException('No se puede cambiar el tipo de un formulario después de haberlo creado.');
    }

    await this.formulariosRepository.update(id, updateFormularioDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const formulario = await this.findOne(id);

    if (formulario.bloqueado) {
      throw new BadRequestException('No se puede eliminar un formulario bloqueado (versión anterior de solo lectura).');
    }

    if (formulario.publicado) {
      throw new BadRequestException('No se puede eliminar un formulario que ya ha sido publicado formalmente.');
    }

    await this.formulariosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Formulario dado de baja con éxito.' };
  }

  // ============================================================
  // CLONAR FORMULARIO / CREAR NUEVA VERSIÓN
  // Reglas: solo se clona la versión actual; la versión clonada
  // (la que era "actual") queda bloqueada; si ya existían 2 versiones
  // vivas, la más antigua se purga físicamente de la base de datos.
  // ============================================================
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

    if (formularioOrigen.bloqueado) {
      throw new BadRequestException(
        'Este formulario es una versión anterior bloqueada. Solo se puede clonar la versión actual (activa) de cada tipo de formulario.',
      );
    }

    // No puede existir ya un formulario de este tipo en el periodo destino.
    const colisionDestino = await this.formulariosRepository.findOne({
      where: {
        tipo_formulario_id: formularioOrigen.tipo_formulario_id,
        periodo_id: nuevoPeriodoId,
        fecha_desactivacion: IsNull(),
      },
    });
    if (colisionDestino) {
      throw new BadRequestException('El periodo destino ya cuenta con un formulario de este mismo tipo.');
    }

    // Todas las versiones vivas de este tipo de formulario (en teoría, máximo 2: anterior + actual).
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

    try {
      // A. PURGA: si ya había 2 (o más) versiones vivas, se elimina físicamente
      // todo lo que sobre de la ventana [anterior, actual]. Gracias al fix de
      // ON DELETE CASCADE en toda la cadena (secciones -> preguntas -> opciones,
      // fichas_respondidas -> respuestas -> historial/documentos/matriz), un solo
      // DELETE sobre "formularios" arrastra absolutamente todo lo asociado a esa versión.
      if (versionesExistentes.length >= 2) {
        const aEliminar = versionesExistentes.slice(0, versionesExistentes.length - 1);
        for (const formularioViejo of aEliminar) {
          await queryRunner.manager.delete(Formulario, formularioViejo.id);
        }
      }

      // B. Bloquear la versión actual: pasa a ser la nueva "versión anterior" de solo lectura.
      await queryRunner.manager.update(Formulario, formularioOrigen.id, {
        bloqueado: true,
        fecha_bloqueo: new Date(),
      });

      // C. Crear la nueva versión ("actual") en BORRADOR, dentro del periodo destino.
      const nuevoFormulario = queryRunner.manager.create(Formulario, {
        titulo: `${formularioOrigen.titulo} (v${nuevaVersionNumero})`,
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

      // D. Clonar estructura completa (idéntico al comportamiento que ya tenías).
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