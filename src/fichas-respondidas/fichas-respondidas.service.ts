import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, InternalServerErrorException } from '@nestjs/common';
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
import * as QRCode from 'qrcode';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class FichasRespondidasService {
  private readonly logger = new Logger(FichasRespondidasService.name);

  private readonly MAX_CONCURRENT_QR_PDF = 3;

  private currentQrPdfJobs = 0;
  private readonly qrPdfWaitQueue: Array<() => void> = [];

  constructor(
    @InjectRepository(FichaRespondida)
    private readonly fichasRepository: Repository<FichaRespondida>,
    private readonly dataSource: DataSource,
    private readonly pdfRenderer: PdfRendererService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(CoordinadoresCarrera)
    private readonly coordinadoresRepository: Repository<CoordinadoresCarrera>,
    private readonly mailService: MailService,
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
      return fichaGuardada;
    } catch (error: any) {
      throw new BadRequestException(`ERROR BD: ${error.message || JSON.stringify(error)}`);
    }
  }

  async getResumenVulnerabilidad(fichaId: string) {
    const alertas = await this.dataSource.query(`
      SELECT p.enunciado as pregunta, 
             REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g') as respuesta
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      LEFT JOIN respuestas_opciones_seleccionadas os ON os.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = os.opcion_id
      WHERE r.ficha_id = $1
        AND r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
        AND UPPER(TRIM(REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g'))) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
    `, [fichaId]);

    return {
      ficha_id: fichaId,
      total_alertas: alertas.length,
      detalles: alertas
    };
  }

  async getFichasPaginadasYFiltradas(skip: number, take: number, search: string, estado: string, user: any) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 10000);
    const skipReal = Math.max(Number(skip) || 0, 0);

    const query = this.fichasRepository.createQueryBuilder('f')
      .leftJoinAndSelect('f.usuario', 'u')
      .leftJoinAndSelect('f.periodo', 'p')
      .where('f.fecha_desactivacion IS NULL')
      .andWhere('f.estado_ficha != :borrador', { borrador: 'BORRADOR' });

    if (user.rol === 'COORDINADOR_CARRERA') {
      const asignaciones = await this.coordinadoresRepository.find({
        where: { usuario_id: user.id },
        select: { carrera_id: true }
      });

      const carrerasIds = asignaciones.map(a => a.carrera_id);

      if (carrerasIds.length === 0) {
        return { data: [], total: 0 };
      }

      query.andWhere('u.carrera_id IN (:...carrerasIds)', { carrerasIds });
    }

    if (estado && estado !== 'TODOS') {
      query.andWhere('f.estado_ficha = :estado', { estado });
    }

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

  async getFichasPorPrioridadVulnerabilidad(nivel: string, periodoId?: string) {
    // Dejamos un límite fijo razonable ya que quitamos la paginación manual
    const limiteReal = 500;
    const skipReal = 0;

    const subQueryAlertas = `
      SELECT r.ficha_id AS ficha_id, COUNT(*)::int AS total_alertas
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
        AND UPPER(TRIM(REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g'))) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      GROUP BY r.ficha_id
    `;

    // 🔥 Convertimos esto en una función que arma el query y APLICA EL PERIODO
    const baseQuery = () => {
      const q = this.fichasRepository.createQueryBuilder('f')
        .leftJoinAndSelect('f.usuario', 'u')
        .leftJoinAndSelect('u.carrera', 'c')
        .leftJoin(`(${subQueryAlertas})`, 'alertas', 'alertas.ficha_id = f.id')
        .where('f.fecha_desactivacion IS NULL')
        .andWhere('f.estado_ficha != :borrador', { borrador: 'BORRADOR' });

      // Aquí está el truco: si llega el periodoId, lo filtramos en la BD
      if (periodoId) {
        q.andWhere('f.periodo_id = :periodoId', { periodoId });
      }

      return q;
    };

    const aplicarFiltroNivel = (query: ReturnType<typeof baseQuery>) => {
      if (nivel === 'CON_ALERTAS') {
        query.andWhere('COALESCE(alertas.total_alertas, 0) > 0');
      } else if (nivel === 'SIN_ALERTAS') {
        query.andWhere('COALESCE(alertas.total_alertas, 0) = 0');
      }
      return query;
    };

    // Ahora los conteos y resultados solo traerán los del periodo actual
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

  async findAll() {
    // 1. Subconsulta para cruzar respuestas con preguntas obligatorias (vulnerabilidad)
    const subQueryAlertas = `
      SELECT r.ficha_id AS ficha_id, COUNT(*)::int AS total_alertas
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
        AND UPPER(TRIM(REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g'))) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      GROUP BY r.ficha_id
    `;

    // 2. QueryBuilder sin el límite de 10 para traer TODO al dashboard
    const { entities, raw } = await this.fichasRepository.createQueryBuilder('f')
      .leftJoinAndSelect('f.usuario', 'u')
      .leftJoinAndSelect('u.carrera', 'c')
      .leftJoinAndSelect('u.ciclo', 'ci')
      .leftJoinAndSelect('f.periodo', 'p')
      .leftJoinAndSelect('f.rangoResultado', 'rr')
      .leftJoinAndSelect('f.cerradoPorUsuario', 'cpu')
      .leftJoin(`(${subQueryAlertas})`, 'alertas', 'alertas.ficha_id = f.id')
      .where('f.fecha_desactivacion IS NULL')
      .addSelect('COALESCE(alertas.total_alertas, 0)', 'total_alertas')
      .orderBy('f.created_at', 'DESC')
      .getRawAndEntities();

    // 3. Mapeo para inyectar el total_alertas dentro de cada objeto ficha
    return entities.map((ficha, index) => ({
      ...ficha,
      total_alertas: Number(raw[index]?.total_alertas) || 0,
    }));
  }

  async findOne(id: string, user?: any) {
    const ficha = await this.fichasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { usuario: true, periodo: true, formulario: true, cerradoPorUsuario: true, rangoResultado: true },
    });

    if (!ficha) {
      throw new NotFoundException('La ficha solicitada no existe o fue dada de baja.');
    }

    if (user) {
      const rolStr = typeof user.rol === 'string' ? user.rol : JSON.stringify(user.rol || '');
      const esCoordinador = rolStr.includes('COORDINADOR');

      if (!esCoordinador && ficha.usuario_id !== user.id) {
        throw new ForbiddenException('No tienes permiso sobre la ficha de otro usuario.');
      }
    }

    return ficha;
  }

  async findByUsuario(usuarioId: string) {
    return this.fichasRepository.find({
      where: { usuario_id: usuarioId, fecha_desactivacion: IsNull() },
      relations: { usuario: true, periodo: true, formulario: true, rangoResultado: true },
      order: { created_at: 'DESC' },
    });
  }

  async getResumenFicha(id: string, user: any, forceRefresh = false) {
    const ficha = await this.findOne(id, user);

    const cacheKey = `form_struct_${ficha.formulario_id}`;
    let formularioCompleto: any = forceRefresh ? null : await this.cacheManager.get(cacheKey);

    if (!formularioCompleto) {
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
      formularioParaRespuesta.secciones = formularioParaRespuesta.secciones.filter(
        (seccion: any) => seccion.fecha_desactivacion === null
      );

      formularioParaRespuesta.secciones.forEach((seccion: any) => {
        if (seccion.preguntas) {
          seccion.preguntas = seccion.preguntas.filter(
            (pregunta: any) => pregunta.fecha_desactivacion === null
          );

          seccion.preguntas.forEach((pregunta: any) => {
            if (pregunta.opciones) {
              pregunta.opciones = pregunta.opciones.filter(
                (opcion: any) => opcion.fecha_desactivacion === null
              );
            }
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
      if (fichaExistente.estado_ficha !== 'BORRADOR' && fichaExistente.estado_ficha !== 'RECHAZADA') {
        throw new BadRequestException('No puedes editar una ficha que ya fue enviada o validada.');
      }
    }

    const datosUpdate: any = { ...updateDto };
    delete datosUpdate.estado_ficha;
    delete datosUpdate.comentario;

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

      this.notificarEstudiantePorCorreo(fichaExistente, estadoNuevo, comentario);
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

    const cacheKey = `form_struct_${ficha.formulario_id}`;
    await this.cacheManager.del(cacheKey);

    const nuevaFechaLimite = (reabrirDto && reabrirDto.dias_extension) ? new Date() : null;
    if (nuevaFechaLimite && reabrirDto && reabrirDto.dias_extension) {
      nuevaFechaLimite.setDate(nuevaFechaLimite.getDate() + reabrirDto.dias_extension);
    }

    await this.cambiarEstado(id, 'BORRADOR', coordinadorId, 'Reapertura autorizada para completar nuevas preguntas agregadas al formulario');

    await this.fichasRepository.update(id, {
      cerrado_manual_por: null,
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

  private templateQrCache: string | null = null;

  private cargarTemplateQr(): string {
    if (process.env.NODE_ENV !== 'production') {
      this.templateQrCache = null;
    }

    if (!this.templateQrCache) {
      const rutaDist = path.join(process.cwd(), 'dist/common/pdf/templates/formularioQR.hbs');
      const rutaSrc = path.join(process.cwd(), 'src/common/pdf/templates/formularioQR.hbs');

      let ruta = '';
      if (fs.existsSync(rutaDist)) {
        ruta = rutaDist;
      } else if (fs.existsSync(rutaSrc)) {
        ruta = rutaSrc;
      } else {
        throw new BadRequestException(`No se encontró la plantilla HBS. Rutas buscadas: ${rutaDist}`);
      }

      this.templateQrCache = fs.readFileSync(ruta, 'utf-8');
    }
    return this.templateQrCache;
  }

  private async acquireQrPdfSlot(): Promise<void> {
    if (this.currentQrPdfJobs < this.MAX_CONCURRENT_QR_PDF) {
      this.currentQrPdfJobs++;
      return;
    }

    await new Promise<void>((resolve) => {
      this.qrPdfWaitQueue.push(resolve);
    });
    this.currentQrPdfJobs++;
  }

  private releaseQrPdfSlot(): void {
    this.currentQrPdfJobs = Math.max(0, this.currentQrPdfJobs - 1);

    const next = this.qrPdfWaitQueue.shift();
    if (next) {
      next();
    }
  }

  private async fetchImageAsBase64(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        this.logger.warn(`Foto no accesible (${response.status}): ${url}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = response.headers.get('content-type') || 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (e: any) {
      this.logger.warn(`No se pudo descargar la foto de perfil: ${url} — ${e.message}`);
      return null;
    }
  }

  /**
   * Genera el PDF resumen (con QR) que se descarga desde la app.
   * El QR codifica la URL pública /qr/ficha/:id con un parámetro `v`
   * (timestamp) para evitar que el visor de PDF del celular/CDN
   * cachee una versión vieja del documento al escanear el mismo
   * código repetidas veces.
   */
  async generarPdfResumenQr(id: string, user: any): Promise<Buffer> {
    await this.acquireQrPdfSlot();

    try {
      const ficha = await this.findOne(id, user);

      const urlFoto = (ficha.usuario as any)?.foto_url || (ficha.usuario as any)?.foto_perfil || null;
      const fotoPerfil = await this.fetchImageAsBase64(urlFoto);

      const fichaParaPdf = {
        ...ficha,
        usuario: {
          ...ficha.usuario,
          foto_url: fotoPerfil,
        },
      };

      const alertas = await this.dataSource.query(`
        SELECT p.enunciado as pregunta, 
               REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g') as respuesta
        FROM respuestas r
        INNER JOIN preguntas p ON p.id = r.pregunta_id
        LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
        LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
        WHERE r.ficha_id = $1
          AND r.fecha_desactivacion IS NULL
          AND p.fecha_desactivacion IS NULL
          AND p.revision_manual_obligatoria = true
          AND UPPER(TRIM(REGEXP_REPLACE(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''), '\\[EVIDENCIA_URL:.*?\\]', '', 'g'))) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      `, [id]);

      const backendUrl = process.env.API_URL || 'https://azuaycare-backend.onrender.com';

      // ?v=Date.now() -> hace que la URL sea única en cada generación,
      // evitando que el visor de PDF del celular reutilice una respuesta cacheada.
      const urlBienestar = `${backendUrl}/qr/ficha/${id}?v=${Date.now()}`;

      const qrCodeBase64 = await QRCode.toDataURL(urlBienestar, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 200,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      const templateFuente = this.cargarTemplateQr();
      const template = this.pdfRenderer.compilarTemplate('formularioQR', templateFuente);

      const html = template({
        ficha: fichaParaPdf,
        alertasVulnerabilidad: alertas,
        qrCode: qrCodeBase64,
        fechaGeneracion: new Date().toLocaleDateString('es-EC')
      });

      return await this.pdfRenderer.renderizarHtmlAPdf(html);

    } catch (error: any) {
      this.logger.error(`Error crítico generando PDF Resumen: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error interno al generar el PDF: ${error.message}`);
    } finally {
      this.releaseQrPdfSlot();
    }
  }

  async generarPdfFicha(id: string, user: any): Promise<Buffer> {
    const data = await this.getResumenFicha(id, user, true);

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

    let totalIngresos = Number(data.ficha.total_ingresos) || 0;
    let totalEgresos = Number(data.ficha.total_egresos) || 0;
    let balanceFinal = Number(data.ficha.balance_final);
    let estatusNombre = data.ficha.rangoResultado?.nombre || null;

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

    const esFichaFinanciera =
      plantilla.mostrar_tabla_rango === true ||
      data.ficha.rangoResultado != null ||
      totalIngresos > 0 ||
      totalEgresos > 0 ||
      balanceFinal !== 0;

    const urlFoto = (data.ficha.usuario as any)?.foto_url || (data.ficha.usuario as any)?.foto_perfil || null;
    const fotoPerfil = await this.fetchImageAsBase64(urlFoto);

    const fichaParaPdf = {
      ...data.ficha,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      balance_final: balanceFinal,
      rangoResultado: data.ficha.rangoResultado || (estatusNombre ? { nombre: estatusNombre } : null),
      usuario: {
        ...data.ficha.usuario,
        foto_url: fotoPerfil
      }
    };

    const dependencias: any[] = await this.dataSource.query(
      `SELECT id, pregunta_id, pregunta_disparadora_id, opcion_disparadora_id, valor_disparador
       FROM preguntas_dependencias
       WHERE fecha_desactivacion IS NULL
         AND pregunta_id IN (
           SELECT p.id FROM preguntas p
           INNER JOIN secciones s ON s.id = p.seccion_id
           WHERE s.formulario_id = $1 AND p.fecha_desactivacion IS NULL
         )`,
      [data.ficha.formulario_id],
    );

    const mapaRespuestas = new Map<string, any>();
    for (const sec of data.formulario_estructurado?.secciones || []) {
      for (const preg of sec.preguntas || []) {
        if (preg.respuesta_estudiante) {
          mapaRespuestas.set(preg.id, preg.respuesta_estudiante);
        }
      }
    }

    const esPreguntaVisiblePdf = (preguntaId: string): boolean => {
      const dep = dependencias.find((d: any) => d.pregunta_id === preguntaId);
      if (!dep) return true;

      const respPadre = mapaRespuestas.get(dep.pregunta_disparadora_id);
      if (!respPadre) return false;

      if (dep.opcion_disparadora_id) {
        const ids = (respPadre.opcionesSeleccionadas || []).map(
          (o: any) => o.opcion_id || o.opcion?.id,
        );
        if (ids.includes(dep.opcion_disparadora_id)) return true;
        if (respPadre.valor_texto === dep.opcion_disparadora_id) return true;
        return false;
      }

      if (dep.valor_disparador != null && dep.valor_disparador !== '') {
        let valorActual = '';
        if (respPadre.opcionesSeleccionadas?.length) {
          valorActual = respPadre.opcionesSeleccionadas
            .map((o: any) => o.opcion?.texto_opcion || '')
            .join(', ');
        } else {
          valorActual = String(respPadre.valor_texto ?? respPadre.valor_numerico ?? '');
        }
        valorActual = valorActual.replace(/\[EVIDENCIA_URL:.*?\]/g, '').trim();
        return valorActual.toLowerCase() === String(dep.valor_disparador).toLowerCase();
      }

      return true;
    };

    const esPreguntaDependiente = (preguntaId: string): boolean =>
      dependencias.some((d: any) => d.pregunta_id === preguntaId);

    const secciones = (data.formulario_estructurado?.secciones || []).map(
      (sec: any, idx: number) => {
        const preguntasRaiz = (sec.preguntas || []).filter(
          (preg: any) =>
            !esPreguntaDependiente(preg.id) && esPreguntaVisiblePdf(preg.id),
        );

        const preguntas = preguntasRaiz.map((preg: any) => {
          const subIds = dependencias
            .filter((d: any) => d.pregunta_disparadora_id === preg.id)
            .map((d: any) => d.pregunta_id)
            .filter((sid: string) => esPreguntaVisiblePdf(sid));

          const subpreguntas = (sec.preguntas || [])
            .filter((p: any) => subIds.includes(p.id))
            .map((sub: any) => ({
              enunciado: sub.enunciado,
              respuestaHtml: this.construirRespuestaHtml(sub.respuesta_estudiante),
            }));

          return {
            enunciado: preg.enunciado,
            respuestaHtml: this.construirRespuestaHtml(preg.respuesta_estudiante),
            subpreguntas,
          };
        });

        return {
          nombre: sec.nombre || sec.titulo || 'Sección sin nombre',
          numero: idx + 1,
          preguntas,
        };
      },
    );

    let tieneDiscapacidad = false;
    let usaLentes = false;
    let enfermedadCronica = '';

    if (data.formulario_estructurado?.secciones) {
      for (const sec of data.formulario_estructurado.secciones) {
        for (const preg of sec.preguntas || []) {
          if (!esPreguntaVisiblePdf(preg.id)) continue;

          const resp = preg.respuesta_estudiante;
          if (!resp) continue;

          let valorTexto = resp.valor_texto || '';
          if (resp.opcionesSeleccionadas?.length > 0) {
            valorTexto = resp.opcionesSeleccionadas
              .map((o: any) => o.opcion?.texto_opcion)
              .join(', ');
          }
          valorTexto = String(valorTexto).replace(/\[EVIDENCIA_URL:.*?\]/g, '').trim();
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

  private async recalcularTotalesParaPdf(fichaId: string, formularioId: string) {
    const ingresosDb = await this.dataSource.manager
      .createQueryBuilder()
      .select('r.valor_numerico', 'num')
      .addSelect('r.valor_texto', 'txt')
      .from('respuestas', 'r')
      .innerJoin('preguntas', 'p', 'p.id = r.pregunta_id')
      .where('r.ficha_id = :fichaId', { fichaId })
      .andWhere("p.categoria_financiera = 'INGRESO'")
      .andWhere('r.fecha_desactivacion IS NULL')
      .getRawMany();

    const egresosDb = await this.dataSource.manager
      .createQueryBuilder()
      .select('r.valor_numerico', 'num')
      .addSelect('r.valor_texto', 'txt')
      .from('respuestas', 'r')
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
        mime: 'image/*',
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
          /^https?:\/\//i.test(ev.url);

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

  private notificarEstudiantePorCorreo(ficha: FichaRespondida, estadoNuevo: string, comentario?: string) {
    const estadosNotificables = ['VALIDADO', 'RECHAZADO', 'RECHAZADA', 'BORRADOR'];
    if (!estadosNotificables.includes(estadoNuevo.toUpperCase()) || !ficha.usuario) return;

    const emailDestino = ficha.usuario.email_institucional || ficha.usuario.email_personal;
    if (!emailDestino) return;

    const nombreCompleto = `${ficha.usuario.primer_nombre} ${ficha.usuario.primer_apellido}`;

    this.mailService.enviarNotificacionEstadoFicha(
      emailDestino, nombreCompleto, estadoNuevo, comentario || ''
    ).catch(e => this.logger.error(`Fallo correo a ${emailDestino}`));
  }

  private async heredarRespuestasAnteriores(nuevaFichaId: string, usuarioId: string, nuevoFormularioId: string) {
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

    if (preguntasNuevas.length === 0) {
      this.logger.error('🚨 El formulario nuevo no tiene preguntas asociadas. Revisa el proceso de clonado.');
      return;
    }

    const mapaPreguntas = new Map<string, string>();
    for (const pv of preguntasViejas) {
      const pn = preguntasNuevas.find((n: any) => n.enunciado.trim().toLowerCase() === pv.enunciado.trim().toLowerCase());
      if (pn) mapaPreguntas.set(pv.id, pn.id);
    }

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
      `SELECT id, pregunta_id, valor_texto, valor_numerico FROM respuestas 
       WHERE ficha_id = $1 AND fecha_desactivacion IS NULL`, [fichaAnterior.id]
    );

    for (const respVieja of respuestasAnteriores) {
      const nuevaPreguntaId = mapaPreguntas.get(respVieja.pregunta_id);
      if (!nuevaPreguntaId) continue;

      const insertRespuesta = await this.dataSource.query(
        `INSERT INTO respuestas (ficha_id, pregunta_id, valor_texto, valor_numerico, creado_por) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [nuevaFichaId, nuevaPreguntaId, respVieja.valor_texto, respVieja.valor_numerico, usuarioId]
      );
      const nuevaRespuestaId = insertRespuesta[0].id;

      const seleccionadas = await this.dataSource.query(
        `SELECT opcion_id FROM respuestas_opciones_seleccionadas WHERE respuesta_id = $1`, [respVieja.id]
      );

      for (const sel of seleccionadas) {
        const nuevaOpcionId = mapaOpciones.get(sel.opcion_id);
        if (nuevaOpcionId) {
          await this.dataSource.query(
            `INSERT INTO respuestas_opciones_seleccionadas (respuesta_id, opcion_id) VALUES ($1, $2)`,
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
  }
}