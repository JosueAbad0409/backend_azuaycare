import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { ReabrirFichaDto } from './dto/reabrir-ficha.dto';

import { Formulario } from '../formularios/entities/formulario.entity';
import { RespuestasFormulario } from '../respuestas-formulario/entities/respuestas-formulario.entity';

// Importaciones para PDF
import { PdfRendererService } from '../common/pdf/pdf-renderer.service';
import * as fs from 'fs';
import * as path from 'path';
import { CoordinadoresCarrera } from 'src/coordinadores-carreras/entities/coordinadores-carrera.entity';

@Injectable()
export class FichasRespondidasService {
  private readonly logger = new Logger(FichasRespondidasService.name);

  constructor(
    @InjectRepository(FichaRespondida)
    private readonly fichasRepository: Repository<FichaRespondida>,
    private readonly dataSource: DataSource,
    private readonly pdfRenderer: PdfRendererService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(CoordinadoresCarrera)
    private readonly coordinadoresRepository: Repository<CoordinadoresCarrera>,
  ) { }

  async create(createDto: CreateFichaRespondidaDto, usuarioId: string) {
    const existeFicha = await this.fichasRepository.findOne({
      where: {
        usuario_id: usuarioId,
        periodo_id: createDto.periodo_id,
        formulario_id: createDto.formulario_id,
        fecha_desactivacion: IsNull(),
      },
      select: { id: true, estado_ficha: true },
    });

    if (existeFicha) {
      throw new BadRequestException(
        `Ya tienes una ficha registrada en este periodo de matrícula en estado: ${existeFicha.estado_ficha}.`,
      );
    }

    const ingresos = createDto.total_ingresos ?? 0;
    const egresos = createDto.total_egresos ?? 0;
    const balanceCalculado = ingresos - egresos;

    const nuevaFicha = this.fichasRepository.create({
      ...createDto,
      usuario_id: usuarioId,
      estado_ficha: 'BORRADOR',
      total_ingresos: ingresos,
      total_egresos: egresos,
      balance_final: balanceCalculado,
      rango_resultado_id: null,
    });

    try {
      const fichaGuardada = await this.fichasRepository.save(nuevaFicha);
      await this.heredarRespuestasAnteriores(fichaGuardada.id, usuarioId, createDto.formulario_id);
      return fichaGuardada;
    } catch (error: any) {
      throw new BadRequestException(`ERROR BD: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Obtiene la lista de fichas paginadas y filtradas por estado o búsqueda parcial por usuario.
   */
  async getFichasPaginadasYFiltradas(skip: number, take: number, search: string, estado: string, user: any) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 10000);
    const skipReal = Math.max(Number(skip) || 0, 0);

    const query = this.fichasRepository.createQueryBuilder('f')
      .leftJoinAndSelect('f.usuario', 'u')
      .leftJoinAndSelect('f.periodo', 'p')
      .where('f.fecha_desactivacion IS NULL')
      .andWhere('f.estado_ficha != :borrador', { borrador: 'BORRADOR' });

    // 🔒 FASE 3: CANDADO DE AISLAMIENTO POR COORDINADOR
    if (user.rol === 'COORDINADOR_CARRERA') {
      // Buscamos las carreras a las que pertenece este coordinador
      const asignaciones = await this.coordinadoresRepository.find({
        where: { usuario_id: user.id },
        select: { carrera_id: true } // Corregido para TypeORM 0.3.x
      });

      const carrerasIds = asignaciones.map(a => a.carrera_id);

      // Si es coordinador de carrera pero por algún motivo no tiene carreras asignadas, devolvemos vacío
      if (carrerasIds.length === 0) {
        return { data: [], total: 0 };
      }

      // Aplicamos el filtro usando el alias 'u' de usuario
      query.andWhere('u.carrera_id IN (:...carrerasIds)', { carrerasIds });
    }

    // Filtro por estado
    if (estado && estado !== 'TODOS') {
      query.andWhere('f.estado_ficha = :estado', { estado });
    }

    // Filtro por término de búsqueda (nombre, apellido, cédula, email)
    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        `(LOWER(u.primer_nombre) LIKE :term OR 
          LOWER(u.primer_apellido) LIKE :term OR 
          LOWER(u.cedula) LIKE :term OR 
          LOWER(u.email_institucional) LIKE :term)`,
        { term }
      );
    }

    // Ejecutamos ambas consultas en paralelo (datos y total)
    const [data, total] = await query
      .orderBy('f.created_at', 'DESC')
      .skip(skipReal)
      .take(limiteReal)
      .getManyAndCount();

    return {
      data,
      total,
    };
  }

  /**
   * Obtiene la lista de fichas ordenadas por cantidad de alertas (respuestas
   * afirmativas a preguntas marcadas como revision_manual_obligatoria).
   * Exclusivo para el equipo de Bienestar.
   *
   * `nivel` acepta: 'TODOS' (default), 'CON_ALERTAS', 'SIN_ALERTAS'.
   */
  async getFichasPorPrioridadVulnerabilidad(skip: number, take: number, nivel: string) {
    const limiteReal = Math.min(Math.max(Number(take) || 50, 1), 500);
    const skipReal = Math.max(Number(skip) || 0, 0);

    // Subconsulta: cuenta, por ficha, cuántas respuestas afirmativas tiene
    // a preguntas marcadas como revision_manual_obligatoria.
    const subQueryAlertas = `
      SELECT r.ficha_id AS ficha_id, COUNT(*)::int AS total_alertas
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
        AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, '')) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      GROUP BY r.ficha_id
    `;

    const baseQuery = () => this.fichasRepository.createQueryBuilder('f')
      .leftJoinAndSelect('f.usuario', 'u')
      .leftJoinAndSelect('u.carrera', 'c')
      .leftJoin(`(${subQueryAlertas})`, 'alertas', 'alertas.ficha_id = f.id')
      .where('f.fecha_desactivacion IS NULL')
      .andWhere('f.estado_ficha != :borrador', { borrador: 'BORRADOR' });

    const aplicarFiltroNivel = (query: ReturnType<typeof baseQuery>) => {
      if (nivel === 'CON_ALERTAS') {
        query.andWhere('COALESCE(alertas.total_alertas, 0) > 0');
      } else if (nivel === 'SIN_ALERTAS') {
        query.andWhere('COALESCE(alertas.total_alertas, 0) = 0');
      }
      return query;
    };

    const total = await aplicarFiltroNivel(baseQuery()).getCount();

    const { entities, raw } = await aplicarFiltroNivel(baseQuery())
      .addSelect('COALESCE(alertas.total_alertas, 0)', 'total_alertas')
      .orderBy('total_alertas', 'DESC')
      .skip(skipReal)
      .take(limiteReal)
      .getRawAndEntities();

    const data = entities.map((ficha, index) => ({
      ...ficha,
      total_alertas: Number(raw[index]?.total_alertas) || 0,
    }));

    return {
      data,
      total,
    };
  }

  findAll(skip: number = 0, take: number = 10) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.fichasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      relations: { usuario: true, periodo: true, cerradoPorUsuario: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, user?: any) {
    const ficha = await this.fichasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { usuario: true, periodo: true, formulario: true, cerradoPorUsuario: true, rangoResultado: true },
    });

    if (!ficha) {
      throw new NotFoundException('La ficha solicitada no existe o fue dada de baja.');
    }

    if (user && !user.rol.includes('COORDINADOR') && ficha.usuario_id !== user.id) {
      throw new ForbiddenException('No tienes permiso sobre la ficha de otro usuario.');
    }

    return ficha;
  }

  async findByUsuario(usuarioId: string) {
    return this.fichasRepository.find({
      where: { usuario_id: usuarioId, fecha_desactivacion: IsNull() },
      relations: { periodo: true, formulario: true, rangoResultado: true },
      order: { created_at: 'DESC' },
    });
  }

  async getResumenFicha(id: string, user: any) {
    const ficha = await this.findOne(id, user);

    const cacheKey = `form_struct_${ficha.formulario_id}`;
    let formularioCompleto: any = await this.cacheManager.get(cacheKey);

    if (!formularioCompleto) {
      this.logger.log(`Caché miss. Consultando DB para formulario ${ficha.formulario_id}`);
      formularioCompleto = await this.dataSource.manager.findOne(Formulario, {
        where: { id: ficha.formulario_id, fecha_desactivacion: IsNull() },
        relations: {
          secciones: {
            preguntas: {
              tipoCampo: true,
              opciones: true,
            }
          }
        },
        order: {
          secciones: { orden: 'ASC', preguntas: { orden: 'ASC', opciones: { orden: 'ASC' } } }
        }
      });

      await this.cacheManager.set(cacheKey, formularioCompleto, 43200000);
    }

    const respuestas = await this.dataSource.manager.find(RespuestasFormulario, {
      where: { ficha_id: id, fecha_desactivacion: IsNull() },
      relations: {
        opcionesSeleccionadas: { opcion: true },
        documentos: true,
        respuestasMatriz: { fila: true, columna: true }
      }
    });

    const formularioParaRespuesta = JSON.parse(JSON.stringify(formularioCompleto));

    if (formularioParaRespuesta && formularioParaRespuesta.secciones) {
      
      // 🔥 1. FILTRAR SECCIONES FANTASMAS (Eliminadas lógicamente)
      formularioParaRespuesta.secciones = formularioParaRespuesta.secciones.filter(
        (seccion: any) => seccion.fecha_desactivacion === null
      );

      formularioParaRespuesta.secciones.forEach((seccion: any) => {
        if (seccion.preguntas) {
          
          // 🔥 2. FILTRAR PREGUNTAS FANTASMAS (Eliminadas lógicamente)
          seccion.preguntas = seccion.preguntas.filter(
            (pregunta: any) => pregunta.fecha_desactivacion === null
          );

          // 3. Asignar las respuestas solo a las preguntas válidas y activas
          seccion.preguntas.forEach((pregunta: any) => {
            pregunta.respuesta_estudiante = respuestas.find((r: any) => r.pregunta_id === pregunta.id) || null;
          });
        }
      });
    }

    return {
      ficha,
      formulario_estructurado: formularioParaRespuesta
    };
  }

  async update(id: string, updateDto: UpdateFichaRespondidaDto, user: any) {
    const fichaExistente = await this.findOne(id, user);
    const esCoordinador = user.rol.includes('COORDINADOR_BIENESTAR') || user.rol.includes('COORDINADOR');

    if (!esCoordinador) {
      if (fichaExistente.estado_ficha === 'CERRADA_MANUAL') throw new BadRequestException('Esta ficha fue cerrada manualmente.');
      if (fichaExistente.estado_ficha === 'CERRADA_POR_PLAZO') throw new BadRequestException('El plazo máximo ha expirado.');
      if (fichaExistente.fecha_limite_edicion && new Date() > new Date(fichaExistente.fecha_limite_edicion)) {
        await this.fichasRepository.update(id, { estado_ficha: 'CERRADA_POR_PLAZO' });
        throw new BadRequestException('El plazo de edición ha vencido.');
      }
      if (fichaExistente.estado_ficha !== 'BORRADOR') throw new BadRequestException('No puedes editar una ficha enviada.');
    }

    const datosUpdate: any = { ...updateDto };
    const estado_ficha = datosUpdate.estado_ficha;
    const comentario = datosUpdate.comentario;

    delete datosUpdate.estado_ficha;
    delete datosUpdate.comentario;

    if (estado_ficha && estado_ficha !== fichaExistente.estado_ficha) {
      await this.dataSource.manager.insert('historial_estados_ficha', {
        ficha_id: id,
        estado_anterior: fichaExistente.estado_ficha,
        estado_nuevo: estado_ficha,
        comentario: comentario || null,
        cambiado_por: user.id
      });
      datosUpdate.estado_ficha = estado_ficha;
    }

    if (datosUpdate.total_ingresos !== undefined || datosUpdate.total_egresos !== undefined) {
      const ingresos = datosUpdate.total_ingresos ?? fichaExistente.total_ingresos;
      const egresos = datosUpdate.total_egresos ?? fichaExistente.total_egresos;
      datosUpdate.balance_final = ingresos - egresos;
    }

    if (Object.keys(datosUpdate).length > 0) {
      await this.fichasRepository.update(id, datosUpdate);
    }

    return this.findOne(id, user);
  }

  async cambiarEstado(id: string, estadoNuevo: string, usuarioId: string, comentario?: string) {
    const fichaExistente = await this.findOne(id);

    if (fichaExistente.estado_ficha !== estadoNuevo) {
      await this.dataSource.manager.insert('historial_estados_ficha', {
        ficha_id: id,
        estado_anterior: fichaExistente.estado_ficha,
        estado_nuevo: estadoNuevo,
        comentario: comentario || null,
        cambiado_por: usuarioId
      });
      await this.fichasRepository.update(id, { estado_ficha: estadoNuevo });
    }

    return this.findOne(id);
  }

  async cerrarManual(id: string, coordinadorId: string) {
    const ficha = await this.findOne(id);
    if (ficha.estado_ficha === 'CERRADA_MANUAL') throw new BadRequestException('La ficha ya se encuentra cerrada.');

    await this.cambiarEstado(id, 'CERRADA_MANUAL', coordinadorId, 'Cierre manual por Bienestar Estudiantil');
    await this.fichasRepository.update(id, { cerrado_manual_por: coordinadorId });

    return this.findOne(id);
  }

  async reabrir(id: string, coordinadorId: string, reabrirDto?: ReabrirFichaDto) {
    const ficha = await this.findOne(id);

    const nuevaFechaLimite = (reabrirDto && reabrirDto.dias_extension) ? new Date() : null;
    if (nuevaFechaLimite && reabrirDto && reabrirDto.dias_extension) {
      nuevaFechaLimite.setDate(nuevaFechaLimite.getDate() + reabrirDto.dias_extension);
    }

    // 🔥 CAMBIO CLAVE AQUÍ: Pasamos la ficha a 'BORRADOR' en lugar de 'ENVIADA'
    // Esto quita el candado de solo lectura en el frontend del estudiante.
    await this.cambiarEstado(id, 'BORRADOR', coordinadorId, 'Reapertura autorizada para completar nuevas preguntas agregadas al formulario');

    await this.fichasRepository.update(id, {
      cerrado_manual_por: null, // Limpiamos por si Bienestar la había cerrado a la fuerza
      fecha_limite_edicion: nuevaFechaLimite
    });

    return this.findOne(id);
  }

  async remove(id: string, user: any) {
    const ficha = await this.findOne(id, user);
    if (ficha.estado_ficha === 'VALIDADO' || ficha.estado_ficha === 'ENVIADO' || ficha.estado_ficha === 'ENVIADA') {
      throw new BadRequestException('No se pueden eliminar fichas que ya han sido enviadas o validadas.');
    }
    await this.fichasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Ficha de respuestas dada de baja con éxito.' };
  }

  private templateFichaCache: string | null = null;

  private cargarTemplateFicha(): string {
  // En desarrollo siempre releer el archivo
  if (process.env.NODE_ENV !== 'production') {
    this.templateFichaCache = null;
  }
  if (!this.templateFichaCache) {
    const rutaTemplate = path.join(process.cwd(), 'dist/common/pdf/templates/ficha-socioeconomica.hbs');
    const ruta = fs.existsSync(rutaTemplate)
      ? rutaTemplate
      : path.join(process.cwd(), 'src/common/pdf/templates/ficha-socioeconomica.hbs');
    this.templateFichaCache = fs.readFileSync(ruta, 'utf-8');
  }
  return this.templateFichaCache;
}


    async generarPdfFicha(id: string, user: any): Promise<Buffer> {
    const data = await this.getResumenFicha(id, user);

    let plantilla: any = await this.dataSource.manager.findOne('plantillas_pdf', {
      where: { formulario_id: data.ficha.formulario_id },
    });

    if (!plantilla) {
      plantilla = {
        color_primario: '#003366',
        color_secundario: '#666666',
        encabezado: 'Sistema de Bienestar Estudiantil',
        pie_pagina: 'Ficha generada automáticamente',
        mostrar_tabla_rango: true,
        logo_url: '',
      };
    }

    // Totales desde la ficha (pueden venir en 0 si el listener no corrió)
    let totalIngresos = Number(data.ficha.total_ingresos) || 0;
    let totalEgresos = Number(data.ficha.total_egresos) || 0;
    let balanceFinal = Number(data.ficha.balance_final);
    let estatusNombre = data.ficha.rangoResultado?.nombre || null;

    // Si no hay totales guardados, recalcular desde respuestas (solo para el PDF)
        // Si no hay totales guardados, recalcular desde respuestas
    if (totalIngresos === 0 && totalEgresos === 0) {
      const recalc = await this.recalcularTotalesParaPdf(id, data.ficha.formulario_id);
      totalIngresos = recalc.totalIngresos;
      totalEgresos = recalc.totalEgresos;
      balanceFinal = recalc.balance;
      if (recalc.rangoNombre) {
        estatusNombre = recalc.rangoNombre;
      }
    }

    if (Number.isNaN(balanceFinal)) {
      balanceFinal = totalIngresos - totalEgresos;
    }

    // 🔥 Siempre resolver clasificación si aún no hay rango asignado
    if (!estatusNombre) {
      const rango = await this.dataSource.manager
        .createQueryBuilder()
        .select('rvc.nombre', 'nombre')
        .from('rangos_variable_calculada', 'rvc')
        .where('rvc.formulario_id = :formId', { formId: data.ficha.formulario_id })
        .andWhere("rvc.variable_calculo = 'BALANCE'")
        .andWhere('CAST(rvc.valor_min AS numeric) <= :balance', { balance: balanceFinal })
        .andWhere('(rvc.valor_max IS NULL OR CAST(rvc.valor_max AS numeric) >= :balance)', {
          balance: balanceFinal,
        })
        .andWhere('rvc.fecha_desactivacion IS NULL')
        .orderBy('rvc.orden', 'ASC')
        .getRawOne();

      if (rango?.nombre) {
        estatusNombre = rango.nombre;
      }
    }

    // Mostrar bloque económico si hay plantilla, rango o cualquier monto
    const esFichaFinanciera =
      plantilla.mostrar_tabla_rango === true ||
      data.ficha.rangoResultado != null ||
      totalIngresos > 0 ||
      totalEgresos > 0 ||
      balanceFinal !== 0;

    const fichaParaPdf = {
      ...data.ficha,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      balance_final: balanceFinal,
      rangoResultado: data.ficha.rangoResultado || (estatusNombre ? { nombre: estatusNombre } : null),
    };

    const secciones = (data.formulario_estructurado?.secciones || []).map((sec: any) => ({
  nombre: sec.nombre || sec.titulo || 'Sección sin nombre',
  preguntas: (sec.preguntas || []).map((preg: any) => ({
    enunciado: preg.enunciado,
    respuestaHtml: this.construirRespuestaHtml(preg.respuesta_estudiante), // ← aquí se incluye la evidencia
  })),
}));

    // Salud / NEE
    let tieneDiscapacidad = false;
    let usaLentes = false;
    let enfermedadCronica = '';

    if (data.formulario_estructurado?.secciones) {
      for (const sec of data.formulario_estructurado.secciones) {
        for (const preg of sec.preguntas || []) {
          const resp = preg.respuesta_estudiante;
          if (!resp) continue;

          let valorTexto = resp.valor_texto || '';
          if (resp.opcionesSeleccionadas?.length > 0) {
            valorTexto = resp.opcionesSeleccionadas
              .map((o: any) => o.opcion?.texto_opcion)
              .join(', ');
          }

          const valorNormalizado = valorTexto.toUpperCase().trim();

          if (preg.codigo_sistema === 'SALUD_DISCAPACIDAD_BOOL') {
            tieneDiscapacidad = valorNormalizado === 'SI' || valorNormalizado === 'SÍ';
          } else if (preg.codigo_sistema === 'SALUD_LENTES_BOOL') {
            usaLentes = valorNormalizado === 'SI' || valorNormalizado === 'SÍ';
          } else if (preg.codigo_sistema === 'SALUD_ENFERMEDAD_CRONICA') {
            enfermedadCronica = valorTexto;
            if (['NINGUNA', 'NO', 'NA', 'N/A'].includes(valorNormalizado)) {
              enfermedadCronica = '';
            }
          }
        }
      }
    }

    const requiereAtencionSalud =
      tieneDiscapacidad || usaLentes || enfermedadCronica !== '';

    const templateFuente = this.cargarTemplateFicha();
    const template = this.pdfRenderer.compilarTemplate(
      'ficha-socioeconomica',
      templateFuente,
    );

    const html = template({
      plantilla,
      formulario: data.formulario_estructurado,
      ficha: fichaParaPdf,
      esFichaFinanciera,
      secciones,
      requiereAtencionSalud,
      tieneDiscapacidad,
      usaLentes,
      enfermedadCronica,
    });

    return this.pdfRenderer.renderizarHtmlAPdf(html);
  }

  

  /** Recalcula ingresos/egresos/balance/rango solo para el PDF (no escribe en BD). */
  private async recalcularTotalesParaPdf(fichaId: string, formularioId: string) {
    const ingresosDb = await this.dataSource.manager
      .createQueryBuilder()
      .select('r.valor_numerico', 'num')
      .addSelect('r.valor_texto', 'txt')
      .from('respuestas_formulario', 'r')
      .innerJoin('preguntas', 'p', 'p.id = r.pregunta_id')
      .where('r.ficha_id = :fichaId', { fichaId })
      .andWhere("p.categoria_financiera = 'INGRESO'")
      .andWhere('r.fecha_desactivacion IS NULL')
      .getRawMany();

    const egresosDb = await this.dataSource.manager
      .createQueryBuilder()
      .select('r.valor_numerico', 'num')
      .addSelect('r.valor_texto', 'txt')
      .from('respuestas_formulario', 'r')
      .innerJoin('preguntas', 'p', 'p.id = r.pregunta_id')
      .where('r.ficha_id = :fichaId', { fichaId })
      .andWhere("p.categoria_financiera = 'EGRESO'")
      .andWhere('r.fecha_desactivacion IS NULL')
      .getRawMany();

    let totalIngresos = 0;
    ingresosDb.forEach((r) => (totalIngresos += Number(r.num) || Number(r.txt) || 0));

    let totalEgresos = 0;
    egresosDb.forEach((r) => (totalEgresos += Number(r.num) || Number(r.txt) || 0));

    const balance = totalIngresos - totalEgresos;

    const rango = await this.dataSource.manager
      .createQueryBuilder()
      .select('rvc.nombre', 'nombre')
      .from('rangos_variable_calculada', 'rvc')
      .where('rvc.formulario_id = :formId', { formId: formularioId })
      .andWhere("rvc.variable_calculo = 'BALANCE'")
      .andWhere(':balance >= rvc.valor_min', { balance })
      .andWhere('(rvc.valor_max IS NULL OR :balance <= rvc.valor_max)', { balance })
      .andWhere('rvc.fecha_desactivacion IS NULL')
      .getRawOne();

    return {
      totalIngresos,
      totalEgresos,
      balance,
      rangoNombre: rango?.nombre || null,
    };
  }

  
  private construirRespuestaHtml(resp: any): string {
  if (!resp) return '<i>Sin responder</i>';

  const escapar = (txt: string) =>
    String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let contenido = '';
  let evidenciaUrlDesdeTexto: string | null = null;

  // Extraer evidencia embebida en valor_texto
  let valorTextoLimpio = resp.valor_texto ? String(resp.valor_texto) : '';
  if (valorTextoLimpio.includes('[EVIDENCIA_URL:')) {
    const match = valorTextoLimpio.match(/\[EVIDENCIA_URL:(.*?)\]/);
    if (match?.[1]) {
      evidenciaUrlDesdeTexto = match[1].trim();
      valorTextoLimpio = valorTextoLimpio.replace(match[0], '').trim();
    }
  }

  if (valorTextoLimpio) {
    contenido = escapar(valorTextoLimpio);
  } else if (resp.valor_numerico !== null && resp.valor_numerico !== undefined) {
    contenido = escapar(resp.valor_numerico.toString());
  } else if (resp.opcionesSeleccionadas?.length > 0) {
    contenido = escapar(
      resp.opcionesSeleccionadas.map((o: any) => o.opcion?.texto_opcion).join(', '),
    );
  } else if (resp.respuestasMatriz?.length > 0) {
    const filasAgrupadas = new Map<string, string[]>();
    resp.respuestasMatriz.forEach((rm: any) => {
      const fila = rm.fila?.texto_fila || 'Criterio';
      const columna = rm.columna?.texto_columna || 'Opción';
      if (!filasAgrupadas.has(fila)) filasAgrupadas.set(fila, []);
      filasAgrupadas.get(fila)!.push(columna);
    });

    let html = `
      <table style="width:100%; border-collapse: collapse; margin-top: 4px; font-size: 11px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="border:1px solid #ccc; padding:5px 8px; text-align:left; width:40%;">Criterio</th>
            <th style="border:1px solid #ccc; padding:5px 8px; text-align:left;">Selección</th>
          </tr>
        </thead>
        <tbody>`;

    filasAgrupadas.forEach((columnas, fila) => {
      html += `
          <tr>
            <td style="border:1px solid #ccc; padding:5px 8px; font-weight:bold;">${escapar(fila)}</td>
            <td style="border:1px solid #ccc; padding:5px 8px;">${escapar(columnas.join(', '))}</td>
          </tr>`;
    });

    html += `
        </tbody>
      </table>`;
    contenido = html;
  }

  // Evidencias / documentos de respaldo asociados a la respuesta
  const documentos = (resp.documentos || []).filter((d: any) => !d.fecha_desactivacion);

  type Ev = { url: string; nombre: string; mime: string };
  const evidencias: Ev[] = [];

  for (const doc of documentos) {
    evidencias.push({
      url: doc.ruta_archivo,
      nombre: doc.nombre_original || 'Archivo',
      mime: doc.mime_type || '',
    });
  }

  if (evidenciaUrlDesdeTexto && !evidencias.some(e => e.url === evidenciaUrlDesdeTexto)) {
  evidencias.push({
    url: evidenciaUrlDesdeTexto,
    nombre: 'Evidencia adjunta',
    mime: 'image/*', // forzar intento de imagen
  });
}

if (evidencias.length > 0) {
  let evidenciasHtml = `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
      <div style="font-size:11px;font-weight:700;color:#047857;margin-bottom:6px;">
        📎 Evidencia adjunta (${evidencias.length})
      </div>`;

  for (const ev of evidencias) {
    const esImagen =
      (ev.mime && ev.mime.toLowerCase().startsWith('image')) ||
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(ev.url) ||
      /^https?:\/\//i.test(ev.url); // Supabase sin extensión → intentar imagen

    const nombre = escapar(ev.nombre);

    if (esImagen && ev.url) {
      evidenciasHtml += `
        <div style="margin:8px 0;">
          <div style="font-size:10px;color:#64748b;margin-bottom:4px;">${nombre}</div>
          <img src="${escapar(ev.url)}"
               alt="${nombre}"
               style="max-width:320px;max-height:240px;border:1px solid #e2e8f0;border-radius:8px;display:block;object-fit:contain;background:#fff;" />
        </div>`;
    } else {
      evidenciasHtml += `
        <div style="font-size:11px;color:#334155;margin:4px 0;padding:6px 8px;background:#f1f5f9;border-radius:6px;">
          📄 ${nombre}
        </div>`;
    }
  }

  evidenciasHtml += `</div>`;
  contenido = (contenido || '<i>Sin texto de respuesta</i>') + evidenciasHtml;
}

  return contenido || '<i>Sin responder</i>';
}

  private async heredarRespuestasAnteriores(nuevaFichaId: string, usuarioId: string, nuevoFormularioId: string) {
    this.logger.log('🔄 --- INICIANDO AUTOCOMPLETADO DE FICHA ---');

    const fichaAnterior = await this.fichasRepository.findOne({
      where: [
        { usuario_id: usuarioId, estado_ficha: 'ENVIADA', fecha_desactivacion: IsNull() },
        { usuario_id: usuarioId, estado_ficha: 'VALIDADO', fecha_desactivacion: IsNull() },
      ],
      order: { created_at: 'DESC' },
    });

    if (!fichaAnterior) {
      this.logger.warn('❌ El estudiante es nuevo o no tiene fichas enviadas. Se cancela autocompletado.');
      return;
    }

    this.logger.log(`✅ Ficha anterior encontrada: ${fichaAnterior.id}`);

    const formViejoId = fichaAnterior.formulario_id;

    const preguntasViejas = await this.dataSource.query(
      `SELECT p.id, p.enunciado FROM preguntas p 
       INNER JOIN secciones s ON s.id = p.seccion_id 
       WHERE s.formulario_id = $1 AND p.fecha_desactivacion IS NULL`, [formViejoId]
    );

    const preguntasNuevas = await this.dataSource.query(
      `SELECT p.id, p.enunciado FROM preguntas p 
       INNER JOIN secciones s ON s.id = p.seccion_id 
       WHERE s.formulario_id = $1 AND p.fecha_desactivacion IS NULL`, [nuevoFormularioId]
    );

    this.logger.log(`📎 Formulario viejo ID: ${formViejoId} | Formulario nuevo ID: ${nuevoFormularioId}`);
    this.logger.log(`📋 Preguntas viejas encontradas: ${preguntasViejas.length}`);
    this.logger.log(`📋 Preguntas nuevas encontradas: ${preguntasNuevas.length}`);

    if (preguntasNuevas.length === 0) {
      this.logger.error('🚨 El formulario nuevo no tiene preguntas asociadas. Revisa el proceso de clonado.');
    }

    const mapaPreguntas = new Map<string, string>();
    for (const pv of preguntasViejas) {
      const pn = preguntasNuevas.find((n: any) => n.enunciado.trim().toLowerCase() === pv.enunciado.trim().toLowerCase());
      if (pn) mapaPreguntas.set(pv.id, pn.id);
    }

    this.logger.log(`🔗 Preguntas emparejadas con éxito: ${mapaPreguntas.size}`);

    const opcionesViejas = await this.dataSource.query(
      `SELECT o.id, o.pregunta_id, o.texto_opcion FROM opciones_pregunta o 
       INNER JOIN preguntas p ON p.id = o.pregunta_id
       INNER JOIN secciones s ON s.id = p.seccion_id 
       WHERE s.formulario_id = $1 AND o.fecha_desactivacion IS NULL`, [formViejoId]
    );

    const opcionesNuevas = await this.dataSource.query(
      `SELECT o.id, o.pregunta_id, o.texto_opcion FROM opciones_pregunta o 
       INNER JOIN preguntas p ON p.id = o.pregunta_id
       INNER JOIN secciones s ON s.id = p.seccion_id 
       WHERE s.formulario_id = $1 AND o.fecha_desactivacion IS NULL`, [nuevoFormularioId]
    );

    const mapaOpciones = new Map<string, string>();
    for (const ov of opcionesViejas) {
      const pNuevaId = mapaPreguntas.get(ov.pregunta_id);
      if (pNuevaId) {
        const on = opcionesNuevas.find((n: any) => n.pregunta_id === pNuevaId && n.texto_opcion.trim().toLowerCase() === ov.texto_opcion.trim().toLowerCase());
        if (on) mapaOpciones.set(ov.id, on.id);
      }
    }

    const respuestasAnteriores = await this.dataSource.query(
      `SELECT id, pregunta_id, valor_texto, valor_numerico FROM respuestas_formulario 
       WHERE ficha_id = $1 AND fecha_desactivacion IS NULL`, [fichaAnterior.id]
    );

    let respuestasInsertadas = 0;

    for (const respVieja of respuestasAnteriores) {
      const nuevaPreguntaId = mapaPreguntas.get(respVieja.pregunta_id);
      if (!nuevaPreguntaId) continue;

      const insertRespuesta = await this.dataSource.query(
        `INSERT INTO respuestas_formulario (ficha_id, pregunta_id, valor_texto, valor_numerico, creado_por) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [nuevaFichaId, nuevaPreguntaId, respVieja.valor_texto, respVieja.valor_numerico, usuarioId]
      );
      const nuevaRespuestaId = insertRespuesta[0].id;
      respuestasInsertadas++;

      const seleccionadas = await this.dataSource.query(
        `SELECT opcion_id FROM opciones_seleccionadas WHERE respuesta_id = $1`, [respVieja.id]
      );
      for (const sel of seleccionadas) {
        const nuevaOpcionId = mapaOpciones.get(sel.opcion_id);
        if (nuevaOpcionId) {
          await this.dataSource.query(
            `INSERT INTO opciones_seleccionadas (respuesta_id, opcion_id) VALUES ($1, $2)`,
            [nuevaRespuestaId, nuevaOpcionId]
          );
        }
      }

      const documentos = await this.dataSource.query(
        `SELECT ruta_archivo, nombre_original, mime_type, tamanio_bytes FROM documentos_respaldo WHERE respuesta_id = $1 AND fecha_desactivacion IS NULL`,
        [respVieja.id]
      );
      for (const doc of documentos) {
        await this.dataSource.query(
          `INSERT INTO documentos_respaldo (respuesta_id, ruta_archivo, nombre_original, mime_type, tamanio_bytes, creado_por) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [nuevaRespuestaId, doc.ruta_archivo, doc.nombre_original, doc.mime_type, doc.tamanio_bytes, usuarioId]
        );
      }
    }

    this.logger.log(`💾 Respuestas insertadas: ${respuestasInsertadas}`);
    this.logger.log('✅ --- AUTOCOMPLETADO FINALIZADO ---');
  }
}