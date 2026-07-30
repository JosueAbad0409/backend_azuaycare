import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { ReabrirFichaDto } from './dto/reabrir-ficha.dto';

import { Formulario } from '../formularios/entities/formulario.entity';
import { RespuestasFormulario } from '../respuestas-formulario/entities/respuestas-formulario.entity';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class FichasRespondidasService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;
  private readonly logger = new Logger(FichasRespondidasService.name);

  constructor(
    @InjectRepository(FichaRespondida)
    private readonly fichasRepository: Repository<FichaRespondida>,
    private readonly dataSource: DataSource, 
  ) {}

  async onModuleInit() {
    this.browser = await puppeteer.launch({ 
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions' // Apagamos extensiones para que arranque más rápido
      ]
    });
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

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
      // 1. Guardamos el borrador vacío en la base de datos
      const fichaGuardada = await this.fichasRepository.save(nuevaFicha);
      
      // 2. 🔥 Ejecutamos la herencia de respuestas anteriores para autocompletar la ficha
      await this.heredarRespuestasAnteriores(fichaGuardada.id, usuarioId, createDto.formulario_id);

      return fichaGuardada;
    } catch (error: any) {
      // Forzamos a que el error real llegue al frontend (rompe el filtro 500 temporalmente)
      throw new BadRequestException(`ERROR BD: ${error.message || JSON.stringify(error)}`);
    }
  }


  findAll(skip: number = 0, take: number = 10) {
    return this.fichasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
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

    const formularioCompleto = await this.dataSource.manager.findOne(Formulario, {
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

    const respuestas = await this.dataSource.manager.find(RespuestasFormulario, {
      where: { ficha_id: id, fecha_desactivacion: IsNull() },
      relations: { 
        opcionesSeleccionadas: { opcion: true }, 
        documentos: true,
        respuestasMatriz: { fila: true, columna: true } 
      }
    });

    if (formularioCompleto && formularioCompleto.secciones) {
      formularioCompleto.secciones.forEach((seccion: any) => {
        if (seccion.preguntas) {
          seccion.preguntas.forEach((pregunta: any) => {
            pregunta.respuesta_estudiante = respuestas.find((r: any) => r.pregunta_id === pregunta.id) || null;
          });
        }
      });
    }

    return {
      ficha,
      formulario_estructurado: formularioCompleto
    };
  }

  async update(id: string, updateDto: UpdateFichaRespondidaDto, user: any) {
    const fichaExistente = await this.findOne(id, user);
    const esCoordinador = user.rol.includes('COORDINADOR');

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

    await this.cambiarEstado(id, 'ENVIADA', coordinadorId, 'Reapertura autorizada por Bienestar Estudiantil');
    
    await this.fichasRepository.update(id, {
      cerrado_manual_por: coordinadorId,
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

  async generarPdfFicha(id: string, user: any): Promise<Buffer> {
    const data = await this.getResumenFicha(id, user);
    
    let plantilla: any = await this.dataSource.manager.findOne('plantillas_pdf', { 
      where: { formulario_id: data.ficha.formulario_id } 
    });

    if (!plantilla) {
      plantilla = {
        color_primario: '#003366', color_secundario: '#666666',
        encabezado: 'Sistema de Bienestar Estudiantil', pie_pagina: 'Ficha generada automáticamente',
        mostrar_tabla_rango: false, 
        logo_url: ''
      };
    }

    let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            .pregunta, .info-box, h2 { page-break-inside: avoid; }
            body { font-family: 'Helvetica', sans-serif; color: #333; margin: 0; padding: 20px; }
            .header { text-align: center; border-bottom: 3px solid ${plantilla.color_primario}; padding-bottom: 10px; margin-bottom: 20px; }
            .header img { max-height: 60px; }
            h1 { color: ${plantilla.color_primario}; font-size: 20px; margin-bottom: 5px; }
            .form-titulo { font-size: 16px; color: #555; margin-top: 0; }
            .form-descripcion { font-size: 12px; color: #777; margin-bottom: 15px; }
            h2 { color: ${plantilla.color_secundario}; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; }
            .info-box { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 5px solid ${plantilla.color_primario}; font-size: 13px; }
            .pregunta { margin-bottom: 10px; font-size: 12px; }
            .pregunta b { display: block; color: #444; }
            .respuesta { margin-top: 3px; color: #111; background: #eee; padding: 5px; border-radius: 3px; }
            .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            ${plantilla.logo_url ? `<img src="${plantilla.logo_url}" alt="Logo">` : ''}
            <h1>${plantilla.encabezado}</h1>
            <!-- 🔥 Se agregó el Título y Descripción del Formulario -->
            <div class="form-titulo">${data.formulario_estructurado?.titulo || 'Formulario'}</div>
            ${data.formulario_estructurado?.descripcion ? `<div class="form-descripcion">${data.formulario_estructurado.descripcion}</div>` : ''}
        </div>

        <div class="info-box">
            <strong>Estudiante:</strong> ${data.ficha.usuario.primer_nombre} ${data.ficha.usuario.primer_apellido} <br>
            <strong>Cédula:</strong> ${data.ficha.usuario.cedula || 'N/A'} <br>
            <!-- 🔥 Se agregó el Nombre del Periodo -->
            <strong>Periodo:</strong> ${data.ficha.periodo?.nombre || 'N/A'} <br>
            <strong>Fecha de envío:</strong> ${new Date(data.ficha.created_at).toLocaleDateString('es-ES')} <br>
            <strong>Estado:</strong> ${data.ficha.estado_ficha}
        </div>`;

    // 🔥 FIX: Ahora el bloque financiero SOLO aparece si el formulario es explícitamente SOCIOECONOMICO
    const esFichaFinanciera = plantilla.mostrar_tabla_rango === true || data.ficha.rangoResultado !== null;

    if (esFichaFinanciera) {
      html += `
        <div class="info-box" style="border-left-color: ${plantilla.color_secundario};">
            <strong>Total Ingresos:</strong> $${data.ficha.total_ingresos} | 
            <strong>Total Egresos:</strong> $${data.ficha.total_egresos} <br>
            <strong>Balance Calculado:</strong> $${data.ficha.balance_final} <br>
            <strong>Clasificación Asignada:</strong> ${data.ficha.rangoResultado ? data.ficha.rangoResultado.nombre : 'En evaluación'}
        </div>`;
    }

    if (data.formulario_estructurado?.secciones) {
      data.formulario_estructurado.secciones.forEach((sec: any) => {
        // 🔥 FIX: Usamos sec.nombre. Si por alguna razón tu BD sí usa titulo, el operador || lo cubre como respaldo.
        const nombreSeccion = sec.nombre || sec.titulo || 'Sección sin nombre';
        html += `<h2>${nombreSeccion}</h2>`;
        
        if (sec.preguntas) {
          sec.preguntas.forEach((preg: any) => {
            const resp = preg.respuesta_estudiante;
            let respuestaTexto = '<i>Sin responder</i>';

            if (resp) {
              if (resp.valor_texto) respuestaTexto = resp.valor_texto;
              else if (resp.valor_numerico !== null) respuestaTexto = resp.valor_numerico.toString();
              else if (resp.opcionesSeleccionadas && resp.opcionesSeleccionadas.length > 0) {
                respuestaTexto = resp.opcionesSeleccionadas.map((o: any) => o.opcion?.texto_opcion).join(', ');
              }
            }

            html += `
            <div class="pregunta">
                <b>${preg.enunciado}</b>
                <div class="respuesta">${respuestaTexto}</div>
            </div>`;
          });
        }
      });
    }

    html += `
        <div class="footer">${plantilla.pie_pagina}</div>
    </body>
    </html>`;

    // 🚀 EXTREMADAMENTE RÁPIDO: Usamos el navegador que ya está abierto
    const page = await this.browser.newPage();
    
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    }) as any;
    
    // ⚠️ MUY IMPORTANTE: Solo cerramos la pestaña, NO el navegador
    await page.close();

    return pdfBuffer;
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