import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; 
import { Express } from 'express';
import 'multer';

import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { DocumentosRespaldoService } from '../documentos-respaldo/documentos-respaldo.service';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { Formulario } from 'src/formularios/entities/formulario.entity';
import { Pregunta } from 'src/preguntas/entities/pregunta.entity';

export interface RespuestaPrecargadaItem {
  pregunta_id: string;
  valor_texto: string | null;
  valor_numerico: number | null;
  opciones_seleccionadas: string[];
}

export interface ResultadoPrecarga {
  es_precargable: boolean;
  message?: string;
  ficha_origen_id?: string;
  respuestas_precargadas: RespuestaPrecargadaItem[];
  preguntas_nuevas_pendientes: string[];
}

@Injectable()
export class RespuestasFormularioService {
  constructor(
    @InjectRepository(RespuestasFormulario)
    private readonly respuestasRepository: Repository<RespuestasFormulario>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly documentosService: DocumentosRespaldoService, 
  ) {}

  async guardarMuchas(
    dtos: any[],
    usuarioId: string, 
    archivos?: Express.Multer.File[],
    esEnvioFinal: boolean = false,
  ) {
    if (!dtos.length) return { success: true, message: 'Sin respuestas para guardar.' };

    const fichasIdsUnicas = [...new Set(dtos.map(dto => dto.ficha_id))];
    
    for (const fId of fichasIdsUnicas) {
      const ficha = await this.dataSource.getRepository(FichaRespondida).findOne({ 
        where: { id: fId }, 
        select: {
          id: true,
          usuario_id: true,
          estado_ficha: true,
          formulario_id: true
        }
      });

      if (!ficha || (ficha as any).usuario_id !== usuarioId) {
        throw new ForbiddenException(`No tienes permiso para insertar respuestas en la ficha seleccionada.`);
      }
    }

    const preguntasIds = [...new Set(dtos.map(dto => dto.pregunta_id))];
    const preguntasData = await this.dataSource.getRepository(Pregunta).find({
      where: { id: In(preguntasIds) },
      relations: { tipoCampo: true }
    });

    for (const dto of dtos) {
      const preguntaBD = preguntasData.find(p => p.id === dto.pregunta_id);
      if (preguntaBD) {
        if (preguntaBD.tipoCampo?.nombre === 'SELECCION_UNICA') {
          if (dto.opciones_seleccionadas && dto.opciones_seleccionadas.length > 1) {
            throw new BadRequestException(
              `Inconsistencia de datos: La pregunta "${preguntaBD.enunciado}" es de SELECCION_UNICA pero se recibieron ${dto.opciones_seleccionadas.length} opciones.`
            );
          }
        }
        if (preguntaBD.tipoCampo?.nombre === 'NUMERICO') {
          if (dto.opciones_seleccionadas && dto.opciones_seleccionadas.length > 0) {
            throw new BadRequestException(
              `Inconsistencia de datos: La pregunta "${preguntaBD.enunciado}" es NUMERICA y no debe recibir opciones seleccionadas.`
            );
          }
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Limpieza de respuestas anteriores (Borrado lógico)
      for (const fId of fichasIdsUnicas) {
        await queryRunner.manager.update(
          RespuestasFormulario, 
          { ficha_id: fId, fecha_desactivacion: IsNull() }, 
          { fecha_desactivacion: new Date() } as any
        );
      }

      let fichaId = '';

      // 2. INSERCIÓN MASIVA OPTIMIZADA
      // Preparamos el array de entidades a crear
      const respuestasACrear = dtos.map(dto => {
        fichaId = dto.ficha_id; // Conservamos el último fichaId para uso posterior
        return this.respuestasRepository.create({
          ficha_id: dto.ficha_id,
          pregunta_id: dto.pregunta_id,
          valor_texto: dto.valor_texto ?? null,
          valor_numerico: dto.valor_numerico ?? null,
        });
      });

      // Guardamos TODAS las respuestas base en una sola transacción
      const respuestasGuardadas = await queryRunner.manager.save(RespuestasFormulario, respuestasACrear);

      const opcionesAInsertar: any[] = [];
      const matricesAInsertar: any[] = [];

      // Relacionamos los IDs autogenerados con sus opciones y matrices
      for (let i = 0; i < dtos.length; i++) {
        const dto = dtos[i];
        const respuestaId = respuestasGuardadas[i].id;

        if (dto.opciones_seleccionadas && dto.opciones_seleccionadas.length > 0) {
          dto.opciones_seleccionadas.forEach((opcionId: string) => {
            opcionesAInsertar.push({ respuesta_id: respuestaId, opcion_id: opcionId });
          });
        }

        if (dto.respuestas_matriz && dto.respuestas_matriz.length > 0) {
          dto.respuestas_matriz.forEach((matriz: any) => {
            matricesAInsertar.push({
              respuesta_id: respuestaId,
              fila_id: matriz.fila_id,
              columna_id: matriz.columna_id,
              valor_texto: matriz.valor_texto ?? null
            });
          });
        }
      }

      // Insertamos las opciones secundarias en bloque
      if (opcionesAInsertar.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into('respuestas_opciones_seleccionadas')
          .values(opcionesAInsertar)
          .execute();
      }

      // Insertamos las matrices secundarias en bloque
      if (matricesAInsertar.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into('respuestas_matriz')
          .values(matricesAInsertar)
          .execute();
      }

      // 3. GESTIÓN DE ESTADO Y PLAZOS
      if (fichaId) {
        const fichaActual = await queryRunner.manager.findOne(FichaRespondida, {
          where: { id: fichaId },
          relations: { formulario: true },
        });

        // Estados desde los que un envío final puede transicionar (BORRADOR normal,
        // o RECHAZADA cuando el estudiante corrige y reenvía).
        const estadosQuePermitenEnvio = ['BORRADOR', 'RECHAZADA'];

        if (fichaActual && esEnvioFinal && estadosQuePermitenEnvio.includes((fichaActual as any).estado_ficha)) {
          // Determina si la ficha tiene alguna respuesta afirmativa a una
          // pregunta marcada como revision_manual_obligatoria (ej. embarazo,
          // discapacidad). Si no tiene ninguna, se valida automáticamente;
          // si tiene al menos una, queda en ENVIADA para revisión del staff.
          const [{ tiene_alertas }] = await queryRunner.manager.query(
            `SELECT EXISTS (
               SELECT 1
               FROM respuestas r
               INNER JOIN preguntas p ON p.id = r.pregunta_id
               LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
               LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
               WHERE r.ficha_id = $1
                 AND r.fecha_desactivacion IS NULL
                 AND p.fecha_desactivacion IS NULL
                 AND p.revision_manual_obligatoria = true
                 AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, '')) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
             ) AS tiene_alertas`,
            [fichaId],
          );

          const datosUpdateFicha: Partial<FichaRespondida> = {
            estado_ficha: tiene_alertas ? 'ENVIADA' : 'VALIDADO',
          };
          
          if (fichaActual.formulario?.dias_plazo_modificacion) {
            const fechaLimite = new Date();
            fechaLimite.setDate(fechaLimite.getDate() + fichaActual.formulario.dias_plazo_modificacion);
            datosUpdateFicha.fecha_limite_edicion = fechaLimite;
          } else {
            datosUpdateFicha.fecha_limite_edicion = null;
          }

          await queryRunner.manager.update(FichaRespondida, fichaId, datosUpdateFicha as any);
        }
      }

      // 4. Manejo de archivos
      if (archivos && archivos.length > 0) {
        const documentosSubidos = await this.documentosService.subirMultiples(archivos);
        
        const documentosAGuardar = documentosSubidos.map(doc => ({
          ...doc,
          ficha_id: fichaId,
        }));
        
        await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into('documentos_respaldo') 
            .values(documentosAGuardar)
            .execute();
      }

      await queryRunner.commitTransaction();

      // 5. Dispara el Evento
      if (fichaId) {
        this.eventEmitter.emit('ficha.respuestas.actualizadas', { fichaId });
      }

      return {
        success: true,
        message: `${respuestasGuardadas.length} respuestas almacenadas de forma optimizada. Balances en cálculo.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerPrecarga(periodoNuevoId: string, usuarioId: string): Promise<ResultadoPrecarga> {
  const formularioNuevo = await this.dataSource.getRepository(Formulario).findOne({
    where: { periodo_id: periodoNuevoId, publicado: true, fecha_desactivacion: IsNull() },
    relations: { secciones: { preguntas: true } },
  });

  if (!formularioNuevo) {
    throw new NotFoundException('No existe un formulario publicado para el nuevo periodo.');
  }

  if (!formularioNuevo.periodo_origen_id) {
    return {
      es_precargable: false,
      message: 'El formulario no proviene de una clonación previa.',
      respuestas_precargadas: [],
      preguntas_nuevas_pendientes: [],
    };
  }

  const fichaAnterior = await this.dataSource.getRepository(FichaRespondida).findOne({
    where: { 
      usuario_id: usuarioId, 
      periodo_id: formularioNuevo.periodo_origen_id,  
      fecha_desactivacion: IsNull() 
    } as any,
    order: { created_at: 'DESC' } as any,
    relations: {
      respuestas: {
        opcionesSeleccionadas: true,
        pregunta: true,
      },
    } as any,
  });

  if (!fichaAnterior) {
    return {
      es_precargable: false,
      message: 'No se encontró una ficha respondida en el periodo anterior.',
      respuestas_precargadas: [],
      preguntas_nuevas_pendientes: [],
    };
  }

  const preguntasFormularioNuevo = (formularioNuevo.secciones || []).flatMap(s => s.preguntas || []);
  const respuestasPrecargadas: RespuestaPrecargadaItem[] = [];
  const preguntasNuevasPendientes: string[] = [];
  const respuestasAnteriores = (fichaAnterior as any).respuestas || [];

  for (const preguntaNueva of preguntasFormularioNuevo) {
    const respuestaCoincidente = respuestasAnteriores.find(
      (r: any) => r.pregunta?.enunciado === preguntaNueva.enunciado || r.pregunta_id === preguntaNueva.id
    );

    if (respuestaCoincidente) {
      respuestasPrecargadas.push({
        pregunta_id: preguntaNueva.id,
        valor_texto: respuestaCoincidente.valor_texto,
        valor_numerico: respuestaCoincidente.valor_numerico,
        opciones_seleccionadas: respuestaCoincidente.opcionesSeleccionadas?.map((o: any) => o.opcion_id) || [],
      });
    } else {
      preguntasNuevasPendientes.push(preguntaNueva.id);
    }
  }

  return {
    es_precargable: true,
    ficha_origen_id: fichaAnterior.id,
    respuestas_precargadas: respuestasPrecargadas,
    preguntas_nuevas_pendientes: preguntasNuevasPendientes,
  };
}

// Reemplaza este método en RespuestasFormularioService (respuestas-formulario.service.ts)
  async ejecutarPrecarga(periodoNuevoId: string, usuarioId: string) {
  // 1. Formulario publicado del periodo nuevo
  const formularioNuevo = await this.dataSource.getRepository(Formulario).findOne({
    where: {
      periodo_id: periodoNuevoId,
      publicado: true,
      fecha_desactivacion: IsNull(),
    },
  });
  if (!formularioNuevo) {
    throw new NotFoundException('No existe un formulario publicado para este periodo.');
  }

  // 2. Ficha actual del estudiante
  const fichaActual = await this.dataSource.getRepository(FichaRespondida).findOne({
    where: {
      usuario_id: usuarioId,
      formulario_id: formularioNuevo.id,
      fecha_desactivacion: IsNull(),
    },
  });
  if (!fichaActual) {
    throw new NotFoundException('No tienes una ficha creada para este periodo todavía.');
  }

  // 3. Si ya tiene respuestas, no volvemos a insertar
  const yaTieneRespuestas = await this.respuestasRepository.count({
    where: { ficha_id: fichaActual.id, fecha_desactivacion: IsNull() },
  });
  if (yaTieneRespuestas > 0) {
    return {
      respuestas_transferidas: false,
      message: 'La ficha ya tiene respuestas guardadas.',
    };
  }

  // 4. Última ficha completada (ENVIADA o VALIDADO)
  const fichaAnterior = await this.dataSource.getRepository(FichaRespondida).findOne({
    where: [
      { usuario_id: usuarioId, estado_ficha: 'ENVIADA', fecha_desactivacion: IsNull() } as any,
      { usuario_id: usuarioId, estado_ficha: 'VALIDADO', fecha_desactivacion: IsNull() } as any,
    ],
    order: { created_at: 'DESC' },
  });

  if (!fichaAnterior) {
    return {
      respuestas_transferidas: false,
      message: 'No hay una ficha anterior completada para clonar.',
    };
  }

  const formViejoId = fichaAnterior.formulario_id;
  const nuevoFormularioId = formularioNuevo.id;
  const nuevaFichaId = fichaActual.id;

  const normalizar = (t: string) =>
    (t || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // 5. Mapear preguntas por enunciado normalizado
  const preguntasViejas = await this.dataSource.query(
    `SELECT p.id, p.enunciado
     FROM preguntas p
     INNER JOIN secciones s ON s.id = p.seccion_id
     WHERE s.formulario_id = $1 AND p.fecha_desactivacion IS NULL`,
    [formViejoId],
  );

  const preguntasNuevas = await this.dataSource.query(
    `SELECT p.id, p.enunciado
     FROM preguntas p
     INNER JOIN secciones s ON s.id = p.seccion_id
     WHERE s.formulario_id = $1 AND p.fecha_desactivacion IS NULL`,
    [nuevoFormularioId],
  );

  if (!preguntasNuevas.length) {
    return {
      respuestas_transferidas: false,
      message: 'Formulario nuevo sin preguntas.',
    };
  }

  const mapaPreguntas = new Map<string, string>();
  for (const pv of preguntasViejas) {
    const pn = preguntasNuevas.find(
      (n: any) => normalizar(n.enunciado) === normalizar(pv.enunciado),
    );
    if (pn) mapaPreguntas.set(pv.id, pn.id);
  }

  // 6. Mapear opciones
  const opcionesViejas = await this.dataSource.query(
    `SELECT o.id, o.pregunta_id, o.texto_opcion
     FROM opciones_pregunta o
     INNER JOIN preguntas p ON p.id = o.pregunta_id
     INNER JOIN secciones s ON s.id = p.seccion_id
     WHERE s.formulario_id = $1 AND o.fecha_desactivacion IS NULL`,
    [formViejoId],
  );

  const opcionesNuevas = await this.dataSource.query(
    `SELECT o.id, o.pregunta_id, o.texto_opcion
     FROM opciones_pregunta o
     INNER JOIN preguntas p ON p.id = o.pregunta_id
     INNER JOIN secciones s ON s.id = p.seccion_id
     WHERE s.formulario_id = $1 AND o.fecha_desactivacion IS NULL`,
    [nuevoFormularioId],
  );

  const mapaOpciones = new Map<string, string>();
  for (const ov of opcionesViejas) {
    const pNuevaId = mapaPreguntas.get(ov.pregunta_id);
    if (!pNuevaId) continue;
    const on = opcionesNuevas.find(
      (n: any) =>
        n.pregunta_id === pNuevaId &&
        normalizar(n.texto_opcion) === normalizar(ov.texto_opcion),
    );
    if (on) mapaOpciones.set(ov.id, on.id);
  }

  // 7. Respuestas de la ficha anterior
  const respuestasAnteriores = await this.dataSource.query(
    `SELECT id, pregunta_id, valor_texto, valor_numerico
     FROM respuestas
     WHERE ficha_id = $1 AND fecha_desactivacion IS NULL`,
    [fichaAnterior.id],
  );

  let respuestasInsertadas = 0;

  for (const respVieja of respuestasAnteriores) {
    const nuevaPreguntaId = mapaPreguntas.get(respVieja.pregunta_id);
    if (!nuevaPreguntaId) continue;

    // ✅ Compatible con tu schema (sin creado_por)
    const insertRespuesta = await this.dataSource.query(
      `INSERT INTO respuestas (ficha_id, pregunta_id, valor_texto, valor_numerico)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        nuevaFichaId,
        nuevaPreguntaId,
        respVieja.valor_texto,
        respVieja.valor_numerico,
      ],
    );
    const nuevaRespuestaId = insertRespuesta[0].id;
    respuestasInsertadas++;

    // Opciones seleccionadas
    const seleccionadas = await this.dataSource.query(
      `SELECT opcion_id
       FROM respuestas_opciones_seleccionadas
       WHERE respuesta_id = $1`,
      [respVieja.id],
    );

    for (const sel of seleccionadas) {
      const nuevaOpcionId = mapaOpciones.get(sel.opcion_id);
      if (nuevaOpcionId) {
        await this.dataSource.query(
          `INSERT INTO respuestas_opciones_seleccionadas (respuesta_id, opcion_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [nuevaRespuestaId, nuevaOpcionId],
        );
      }
    }

    // Matriz
    const matrices = await this.dataSource.query(
      `SELECT fila_id, columna_id
       FROM respuestas_matriz
       WHERE respuesta_id = $1`,
      [respVieja.id],
    );

    if (matrices.length > 0) {
      const filasViejas = await this.dataSource.query(
        `SELECT id, texto_fila FROM filas_matriz
         WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL`,
        [respVieja.pregunta_id],
      );
      const filasNuevas = await this.dataSource.query(
        `SELECT id, texto_fila FROM filas_matriz
         WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL`,
        [nuevaPreguntaId],
      );
      const colsViejas = await this.dataSource.query(
        `SELECT id, texto_columna FROM columnas_matriz
         WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL`,
        [respVieja.pregunta_id],
      );
      const colsNuevas = await this.dataSource.query(
        `SELECT id, texto_columna FROM columnas_matriz
         WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL`,
        [nuevaPreguntaId],
      );

      const mapaFilas = new Map<string, string>();
      for (const fv of filasViejas) {
        const fn = filasNuevas.find(
          (n: any) => normalizar(n.texto_fila) === normalizar(fv.texto_fila),
        );
        if (fn) mapaFilas.set(fv.id, fn.id);
      }

      const mapaCols = new Map<string, string>();
      for (const cv of colsViejas) {
        const cn = colsNuevas.find(
          (n: any) => normalizar(n.texto_columna) === normalizar(cv.texto_columna),
        );
        if (cn) mapaCols.set(cv.id, cn.id);
      }

      for (const m of matrices) {
        const nuevaFilaId = mapaFilas.get(m.fila_id);
        const nuevaColId = mapaCols.get(m.columna_id);
        if (nuevaFilaId && nuevaColId) {
          await this.dataSource.query(
            `INSERT INTO respuestas_matriz (respuesta_id, fila_id, columna_id)
             VALUES ($1, $2, $3)`,
            [nuevaRespuestaId, nuevaFilaId, nuevaColId],
          );
        }
      }
    }

    // Documentos / evidencias
    const documentos = await this.dataSource.query(
      `SELECT ruta_archivo, nombre_original, mime_type, tamanio_bytes
       FROM documentos_respaldo
       WHERE respuesta_id = $1 AND fecha_desactivacion IS NULL`,
      [respVieja.id],
    );

    for (const doc of documentos) {
      // ✅ Schema real: usuario_id NOT NULL (no existe creado_por)
      await this.dataSource.query(
        `INSERT INTO documentos_respaldo
         (respuesta_id, ruta_archivo, nombre_original, mime_type, tamanio_bytes, usuario_id, ficha_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          nuevaRespuestaId,
          doc.ruta_archivo,
          doc.nombre_original,
          doc.mime_type,
          doc.tamanio_bytes,
          usuarioId,
          nuevaFichaId,
        ],
      );
    }
  }

  this.eventEmitter.emit('ficha.respuestas.actualizadas', {
    fichaId: fichaActual.id,
  });

  return {
    respuestas_transferidas: respuestasInsertadas > 0,
    total: respuestasInsertadas,
    message:
      respuestasInsertadas > 0
        ? `Se importaron ${respuestasInsertadas} respuestas.`
        : 'No se encontraron preguntas coincidentes para clonar.',
  };
}

  async findByFicha(fichaId: string) {
  return this.respuestasRepository.find({
    where: { ficha_id: fichaId, fecha_desactivacion: IsNull() },
    relations: {
      pregunta: true,
      opcionesSeleccionadas: true,
      documentos: true,
      respuestasMatriz: { fila: true, columna: true }, // 👈 agregado
    },
  });
}

  // 👇 LÍMITE DE SEGURIDAD APLICADO AQUÍ
  async findAll(skip: number = 0, take: number = 10) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);

    return this.respuestasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      relations: { pregunta: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const respuesta = await this.respuestasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { pregunta: true, opcionesSeleccionadas: true },
    });
    if (!respuesta) {
      throw new NotFoundException('La respuesta solicitada no existe o está inactiva.');
    }
    return respuesta;
  }
}