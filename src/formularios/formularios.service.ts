import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { Formulario } from './entities/formulario.entity';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';
import { Seccion } from 'src/secciones/entities/secciones.entity';
import { Pregunta } from 'src/preguntas/entities/pregunta.entity';
import { OpcionPregunta } from 'src/opciones-pregunta/entities/opciones-pregunta.entity';
import { FilaMatriz } from 'src/matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from 'src/matrices-form/entities/columna-matriz.entity';
import { PreguntaDependencia } from 'src/preguntas-dependencias/entities/pregunta-dependencia.entity';

@Injectable()
export class FormulariosService {
  constructor(
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createFormularioDto: CreateFormularioDto, usuarioId: string) {
    const ultimaVersion = await this.formulariosRepository.findOne({
      where: { periodo_id: createFormularioDto.periodo_id, fecha_desactivacion: IsNull() },
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
      relations: { periodo: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { periodo: true },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    return formulario;
  }

  async publicarFormulario(id: string) {
    // 1. Cargamos el formulario con sus relaciones usando la sintaxis de objeto
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: {
        secciones: {
          preguntas: true,
        },
      }, 
    });

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    // 2. Control de estado
    if (formulario.publicado) {
      throw new BadRequestException('Este formulario ya se encuentra publicado.');
    }

    // 3. Validación de integridad (No publicar si está vacío)
    if (!formulario.secciones || formulario.secciones.length === 0) {
      throw new BadRequestException('No se puede publicar un formulario sin secciones estructuradas.');
    }

    const tienePreguntas = formulario.secciones.some(
      (seccion) => seccion.preguntas && seccion.preguntas.length > 0
    );

    if (!tienePreguntas) {
      throw new BadRequestException('No se puede publicar un formulario sin al menos una pregunta dentro de sus secciones.');
    }

    await this.formulariosRepository.update(id, {
      publicado: true,
      fecha_publicacion: new Date(),
    });

    return this.findOne(id);
  }

  async update(id: string, updateFormularioDto: UpdateFormularioDto) {
    const formulario = await this.findOne(id);

    // 🔥 BLOQUEO ESTRATÉGICO: Congelamiento del diseño si está publicado
    if (formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales.');
    }

    if (formulario.periodo && (formulario.periodo as any).bloqueado) {
      throw new BadRequestException('No se puede modificar un formulario de un periodo que se encuentra bloqueado.');
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

  async clonarHaciaNuevoPeriodo(formularioOrigenId: string, nuevoPeriodoId: string, usuarioId: string) {
    // 1. Sintaxis de objeto en `relations` para evitar error TS2559
    const formularioOrigen = await this.formulariosRepository.findOne({
      where: { id: formularioOrigenId, fecha_desactivacion: IsNull() },
      relations: {
        periodo: true,
        secciones: {
          preguntas: {
            opciones: true,
            filas: true,
            columnas: true,
            dependencias: true,
          },
        },
      },
    });

    if (!formularioOrigen) {
      throw new NotFoundException('El formulario origen no existe o está inactivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Casteo seguro para el bloqueo de periodo hasta actualizar la entidad PeriodoMatricula
      if (formularioOrigen.periodo) {
        await queryRunner.manager.update(PeriodoMatricula, formularioOrigen.periodo.id, {
          bloqueado: true,
          fecha_bloqueo: new Date(),
          activo: false,
        } as any);
      }

      // 3. Crear nuevo formulario
      const nuevoFormulario = queryRunner.manager.create(Formulario, {
        titulo: formularioOrigen.titulo,
        descripcion: formularioOrigen.descripcion,
        tipo: formularioOrigen.tipo,
        periodo_id: nuevoPeriodoId,
        periodo_origen_id: formularioOrigen.id,
        dias_plazo_modificacion: formularioOrigen.dias_plazo_modificacion,
        version: 1,
        publicado: false,
        creado_por: usuarioId,
      });

      const formularioClonado = await queryRunner.manager.save(Formulario, nuevoFormulario);

      const mapaIdsViejosANuevos = new Map<string, string>();
      const dependenciasAClonar: { original: PreguntaDependencia; nuevaPreguntaId: string }[] = [];

      // 4. Clonar Secciones en Cascada
      for (const seccionOrigen of formularioOrigen.secciones || []) {
        if (seccionOrigen.fecha_desactivacion) continue;

        const nuevaSeccion = queryRunner.manager.create(Seccion, {
          formulario_id: formularioClonado.id,
          nombre: seccionOrigen.nombre,
          orden: seccionOrigen.orden,
          creado_por: usuarioId,
        });
        const seccionClonada = await queryRunner.manager.save(Seccion, nuevaSeccion);

        // 5. Clonar Preguntas
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

          // Clonar Opciones con respaldo contra propiedades inexistentes
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

          // Clonar Filas de Matriz
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

          // Clonar Columnas de Matriz
          for (const colOrigen of preguntaOrigen.columnas || []) {
            if ((colOrigen as any).fecha_desactivacion) continue;
            const nuevaColumna = queryRunner.manager.create(ColumnaMatriz, {
              pregunta_id: preguntaClonada.id,
              texto_columna: (colOrigen as any).texto_columna,
              orden: (colOrigen as any).orden,
              creado_por: usuarioId,
              ...((colOrigen as any).tipo_campo_id && {
                tipo_campo_id: (colOrigen as any).tipo_campo_id,
              }),
            } as any);
            await queryRunner.manager.save(ColumnaMatriz, nuevaColumna);
          }

          // Guardar dependencias
          for (const depOrigen of preguntaOrigen.dependencias || []) {
            if (depOrigen.fecha_desactivacion) continue;
            dependenciasAClonar.push({
              original: depOrigen,
              nuevaPreguntaId: preguntaClonada.id,
            });
          }
        }
      }

      // 6. Remapear y Guardar PreguntasDependencias
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