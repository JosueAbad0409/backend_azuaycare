import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import * as path from 'path';
import { PdfRendererService } from '../common/pdf/pdf-renderer.service';
import { FiltroReporteDto } from './dto/filtro-reporte.dto';

@Injectable()
export class ReportesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pdfRendererService: PdfRendererService,
  ) { }

  /**
   * Obtiene el resumen consolidado de métricas generales, periodo activo y datos preparativos
   * para los gráficos del Dashboard sin caer en over-fetching.
   */
  async obtenerDashboardResumen() {
    // 1. Obtener Periodo Activo
    const periodoActivo = await this.dataSource.query(
      `SELECT id, nombre, fecha_inicio, fecha_fin, activo 
       FROM periodos_matricula 
       WHERE activo = true AND fecha_desactivacion IS NULL 
       LIMIT 1`
    );

    const periodo = periodoActivo.length > 0 ? periodoActivo[0] : null;

    // 2. Totales Generales rápidos
    const totalCarreras = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM carreras WHERE fecha_desactivacion IS NULL`
    );
    const totalFormularios = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM formularios WHERE fecha_desactivacion IS NULL`
    );
    const totalFichas = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM fichas_respondidas WHERE fecha_desactivacion IS NULL`
    );

    // 3. Gráfico de Pastel (Rangos de Vulnerabilidad / Niveles) - Corregido a rangos_variable_calculada
    const nivelesData = await this.dataSource.query(
      `SELECT COALESCE(r.nombre, 'Sin Rango') as label, COUNT(f.id)::int as total
       FROM fichas_respondidas f
       LEFT JOIN rangos_variable_calculada r ON r.id = f.rango_resultado_id
       WHERE f.fecha_desactivacion IS NULL
       GROUP BY r.nombre`
    );

    // 3.5. Gráfico de Pastel (Fichas con alertas de revisión, según respuestas)
    const vulnerabilidadData = await this.dataSource.query(
      `WITH AlertasPorFicha AS (
         SELECT r.ficha_id, COUNT(*)::int AS total_alertas
         FROM respuestas r
         INNER JOIN preguntas p ON p.id = r.pregunta_id
         LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
         LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
         WHERE r.fecha_desactivacion IS NULL
           AND p.fecha_desactivacion IS NULL
           AND p.revision_manual_obligatoria = true
           AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, '')) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
         GROUP BY r.ficha_id
       )
       SELECT
         CASE WHEN a.total_alertas > 0 THEN 'Con alertas' ELSE 'Sin alertas' END AS label,
         COUNT(f.id)::int AS total
       FROM fichas_respondidas f
       LEFT JOIN AlertasPorFicha a ON a.ficha_id = f.id
       WHERE f.fecha_desactivacion IS NULL
       GROUP BY label`
    );

    // 4. Gráfico de Barras (Fichas por Carrera)
    const carrerasData = await this.dataSource.query(
      `SELECT 
        c.nombre AS carrera,
        COUNT(f.id) FILTER (WHERE f.estado_ficha IN ('ENVIADA', 'ENVIADO'))::int AS enviadas,
        COUNT(f.id) FILTER (WHERE f.estado_ficha = 'VALIDADO')::int AS validadas
       FROM carreras c
       LEFT JOIN usuarios u ON u.carrera_id = c.id
       LEFT JOIN fichas_respondidas f ON f.usuario_id = u.id AND f.fecha_desactivacion IS NULL
       WHERE c.fecha_desactivacion IS NULL
       GROUP BY c.nombre
       ORDER BY c.nombre ASC`
    );

    return {
      totalCarreras: totalCarreras[0]?.total || 0,
      totalFormularios: totalFormularios[0]?.total || 0,
      totalFichasEvaluadas: totalFichas[0]?.total || 0,
      periodoActivo: periodo,
      graficos: {
        nivelesEconomicos: {
          labels: nivelesData.map((n: any) => n.label),
          data: nivelesData.map((n: any) => Number(n.total) || 0)
        },
        // 🔥 NUEVO GRÁFICO AGREGADO:
        nivelesVulnerabilidad: {
          labels: vulnerabilidadData.map((n: any) => n.label),
          data: vulnerabilidadData.map((n: any) => Number(n.total) || 0)
        },
        fichasPorCarrera: {
          labels: carrerasData.map((c: any) => c.carrera),
          enviadas: carrerasData.map((c: any) => Number(c.enviadas) || 0),
          validadas: carrerasData.map((c: any) => Number(c.validadas) || 0)
        }
      }
    };
  }
  /**
   * Obtiene el reporte especializado de Necesidades Educativas y Salud
   */
  async obtenerReporteEspecializadoNee(periodoId: string) {
  const query = `
    WITH RespuestasVulnerables AS (
      SELECT
        r.ficha_id,
        p.enunciado AS pregunta,
        COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text) AS respuesta,
        p.revision_manual_obligatoria,
        CASE WHEN EXISTS (
          SELECT 1 FROM documentos_respaldo d
          WHERE d.respuesta_id = r.id AND d.fecha_desactivacion IS NULL
        ) THEN true ELSE false END AS tiene_evidencia
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      -- Usar el nombre real de la tabla de opciones seleccionadas:
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
    ),
    FichasFiltradas AS (
      SELECT
        ficha_id,
        jsonb_object_agg(
          pregunta,
          jsonb_build_object('respuesta', respuesta, 'evidencia', tiene_evidencia)
        ) as detalles_vulnerabilidad,
        COUNT(*) as total_alertas
      FROM RespuestasVulnerables
      WHERE
        -- Solo se manda a revisión si la respuesta es afirmativa
        -- (no cuando responde "No", "Ninguna", "N/A", etc.)
        UPPER(COALESCE(respuesta, '')) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      GROUP BY ficha_id
    )
    SELECT
      f.id as ficha_id,
      u.primer_nombre || ' ' || COALESCE(u.segundo_nombre, '') || ' ' || u.primer_apellido as estudiante,
      u.cedula,
      c.nombre as carrera,
      ci.nombre as ciclo,
      ff.detalles_vulnerabilidad,
      ff.total_alertas
    FROM FichasFiltradas ff
    INNER JOIN fichas_respondidas f ON f.id = ff.ficha_id
    INNER JOIN usuarios u ON u.id = f.usuario_id
    LEFT JOIN carreras c ON c.id = u.carrera_id
    LEFT JOIN ciclos ci ON ci.id = u.ciclo_id
    WHERE f.periodo_id = $1
      AND f.estado_ficha NOT IN ('BORRADOR')
      AND f.fecha_desactivacion IS NULL
    ORDER BY ff.total_alertas DESC
  `;
  return await this.dataSource.query(query, [periodoId]);
}

  /**
   * Genera el JSON estructurado con métricas y agregaciones por cada pregunta
   * para dibujar gráficos automáticos en el dashboard sin hardcodear nada en el frontend.
   */
  async obtenerEstructuraAgregada(formularioId: string) {
    const formulario = await this.dataSource.query(
      `SELECT id, titulo, descripcion, periodo_id FROM formularios WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [formularioId],
    );

    if (!formulario || formulario.length === 0) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    // 1. Obtener Secciones y Preguntas ordenadas
    const estructuraFormulario = await this.dataSource.query(
      `
      SELECT 
        s.id AS seccion_id,
        s.nombre AS seccion_nombre,
        s.orden AS seccion_orden,
        p.id AS pregunta_id,
        p.enunciado,
        p.orden AS pregunta_orden,
        t.nombre AS tipo_campo
      FROM secciones s
      INNER JOIN preguntas p ON p.seccion_id = s.id AND p.fecha_desactivacion IS NULL
      INNER JOIN tipos_campo_form t ON t.id = p.tipo_campo_id
      WHERE s.formulario_id = $1 AND s.fecha_desactivacion IS NULL
      ORDER BY s.orden ASC, p.orden ASC
      `,
      [formularioId],
    );

    // 2. Total de fichas enviadas para cálculo de porcentajes
    const totalFichasQuery = await this.dataSource.query(
      `SELECT COUNT(id)::int AS total FROM fichas_respondidas WHERE formulario_id = $1 AND fecha_desactivacion IS NULL`,
      [formularioId],
    );
    const totalFichas = totalFichasQuery[0]?.total || 0;

    const reporteEstructurado: any[] = [];

    // 3. Procesar cada pregunta según su tipo
    for (const preg of estructuraFormulario) {
      const tipoCampo = preg.tipo_campo.toUpperCase();
      let metricas: any = null;

      if (tipoCampo.includes('OPCION') || tipoCampo.includes('SELECT') || tipoCampo.includes('CHECKBOX') || tipoCampo.includes('RADIO')) {
        const opcionesConteo = await this.dataSource.query(
          `
          SELECT 
            op.id AS opcion_id,
            op.texto_opcion,
            COUNT(ros.respuesta_id)::int AS conteo
          FROM opciones_pregunta op
          LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.opcion_id = op.id
          LEFT JOIN respuestas r ON r.id = ros.respuesta_id AND r.pregunta_id = $1 AND r.fecha_desactivacion IS NULL
          WHERE op.pregunta_id = $1 AND op.fecha_desactivacion IS NULL
          GROUP BY op.id, op.texto_opcion, op.orden
          ORDER BY op.orden ASC
          `,
          [preg.pregunta_id],
        );

        metricas = {
          tipo_grafico: 'PIE_O_BARRA',
          opciones: opcionesConteo.map((o: any) => ({
            opcion_id: o.opcion_id,
            texto: o.texto_opcion,
            conteo: o.conteo,
            porcentaje: totalFichas > 0 ? parseFloat(((o.conteo / totalFichas) * 100).toFixed(2)) : 0,
          })),
        };
      } else if (tipoCampo.includes('NUMERIC') || tipoCampo.includes('NUMERO') || tipoCampo.includes('MONEDA')) {
        const numStats = await this.dataSource.query(
          `
          SELECT 
            COALESCE(AVG(valor_numerico), 0)::float AS promedio,
            COALESCE(MIN(valor_numerico), 0)::float AS minimo,
            COALESCE(MAX(valor_numerico), 0)::float AS maximo,
            COALESCE(SUM(valor_numerico), 0)::float AS suma
          FROM respuestas
          WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL
          `,
          [preg.pregunta_id],
        );

        metricas = {
          tipo_grafico: 'METRICA_NUMERICA',
          promedio: parseFloat((numStats[0]?.promedio || 0).toFixed(2)),
          minimo: numStats[0]?.minimo || 0,
          maximo: numStats[0]?.maximo || 0,
          suma: numStats[0]?.suma || 0,
        };
      } else if (tipoCampo.includes('MATRIZ')) {
        const matrizConteo = await this.dataSource.query(
          `
          SELECT 
            rm.fila_id,
            fm.texto_fila,
            rm.columna_id,
            cm.texto_columna,
            COUNT(rm.respuesta_id)::int AS conteo
          FROM respuestas_matriz rm
          INNER JOIN filas_matriz fm ON fm.id = rm.fila_id
          INNER JOIN columnas_matriz cm ON cm.id = rm.columna_id
          INNER JOIN respuestas r ON r.id = rm.respuesta_id AND r.pregunta_id = $1 AND r.fecha_desactivacion IS NULL
          WHERE r.pregunta_id = $1
          GROUP BY rm.fila_id, fm.texto_fila, rm.columna_id, cm.texto_columna
          `,
          [preg.pregunta_id],
        );

        metricas = {
          tipo_grafico: 'MATRIZ_AGREGADA',
          matriz_respuestas: matrizConteo,
        };
      } else {
        const totalRespuestasTexto = await this.dataSource.query(
          `SELECT COUNT(id)::int AS conteo FROM respuestas WHERE pregunta_id = $1 AND valor_texto IS NOT NULL AND fecha_desactivacion IS NULL`,
          [preg.pregunta_id],
        );

        metricas = {
          tipo_grafico: 'TEXTO_LIBRE',
          total_respuestas: totalRespuestasTexto[0]?.conteo || 0,
        };
      }

      reporteEstructurado.push({
        seccion_id: preg.seccion_id,
        seccion_nombre: preg.seccion_nombre,
        pregunta_id: preg.pregunta_id,
        enunciado: preg.enunciado,
        tipo_campo: preg.tipo_campo,
        metricas,
      });
    }

    return {
      formulario: formulario[0],
      total_fichas_respondidas: totalFichas,
      estructura_agregada: reporteEstructurado,
    };
  }

  async obtenerFiltrosDisponibles(formularioId: string) {
    const formulario = await this.dataSource.query(
      `SELECT id FROM formularios WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [formularioId],
    );

    if (!formulario || formulario.length === 0) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    const preguntas = await this.dataSource.query(
      `
      SELECT 
        s.id AS seccion_id,
        s.nombre AS seccion_nombre,
        s.orden AS seccion_orden,
        p.id AS pregunta_id,
        p.enunciado,
        p.orden AS pregunta_orden,
        t.nombre AS tipo_campo
      FROM secciones s
      INNER JOIN preguntas p ON p.seccion_id = s.id AND p.fecha_desactivacion IS NULL
      INNER JOIN tipos_campo_form t ON t.id = p.tipo_campo_id
      WHERE s.formulario_id = $1 AND s.fecha_desactivacion IS NULL
      ORDER BY s.orden ASC, p.orden ASC
      `,
      [formularioId],
    );

    const filtros: any[] = [];

    for (const pregunta of preguntas) {
      const tipoCampo = pregunta.tipo_campo.toUpperCase();
      const filtro: any = {
        pregunta_id: pregunta.pregunta_id,
        enunciado: pregunta.enunciado,
        seccion_nombre: pregunta.seccion_nombre,
        tipo_campo: pregunta.tipo_campo,
      };

      if (tipoCampo.includes('OPCION') || tipoCampo.includes('SELECT') || tipoCampo.includes('CHECKBOX') || tipoCampo.includes('RADIO')) {
        filtro.opciones = await this.dataSource.query(
          `
          SELECT id AS opcion_id, texto_opcion
          FROM opciones_pregunta
          WHERE pregunta_id = $1 AND fecha_desactivacion IS NULL
          ORDER BY orden ASC
          `,
          [pregunta.pregunta_id],
        );
      }

      filtro.es_numerico = tipoCampo.includes('NUMERIC') || tipoCampo.includes('NUMERO') || tipoCampo.includes('MONEDA');
      filtros.push(filtro);
    }

    return filtros;
  }

  private construirCondicionesFiltros(filtros: FiltroReporteDto) {
    const condiciones: string[] = ['f.periodo_id = :periodo_id', 'f.fecha_desactivacion IS NULL'];
    const parametros: Record<string, any> = { periodo_id: filtros.periodo_id };

    if (filtros.formulario_id) {
      condiciones.push('f.formulario_id = :formulario_id');
      parametros.formulario_id = filtros.formulario_id;
    }

    if (filtros.carrera_id) {
      condiciones.push('u.carrera_id = :carrera_id');
      parametros.carrera_id = filtros.carrera_id;
    }

    if (filtros.ciclo_id) {
      condiciones.push('u.ciclo_id = :ciclo_id');
      parametros.ciclo_id = filtros.ciclo_id;
    }

    if (filtros.estado_ficha && filtros.estado_ficha !== 'TODOS') {
      condiciones.push('f.estado_ficha = :estado_ficha');
      parametros.estado_ficha = filtros.estado_ficha;
    }

    filtros.preguntas?.forEach((pregunta, index) => {
      const condicionesSubquery: string[] = [
        'r.ficha_id = f.id',
        `r.pregunta_id = :pregunta_id_${index}`,
        'r.fecha_desactivacion IS NULL',
      ];
      parametros[`pregunta_id_${index}`] = pregunta.pregunta_id;

      if (pregunta.opcion_id) {
        condicionesSubquery.push(`ros.opcion_id = :opcion_id_${index}`);
        parametros[`opcion_id_${index}`] = pregunta.opcion_id;
      }

      if (pregunta.valor_min !== undefined && pregunta.valor_max !== undefined) {
        condicionesSubquery.push(`r.valor_numerico BETWEEN :valor_min_${index} AND :valor_max_${index}`);
        parametros[`valor_min_${index}`] = pregunta.valor_min;
        parametros[`valor_max_${index}`] = pregunta.valor_max;
      } else if (pregunta.valor_min !== undefined) {
        condicionesSubquery.push(`r.valor_numerico >= :valor_min_${index}`);
        parametros[`valor_min_${index}`] = pregunta.valor_min;
      } else if (pregunta.valor_max !== undefined) {
        condicionesSubquery.push(`r.valor_numerico <= :valor_max_${index}`);
        parametros[`valor_max_${index}`] = pregunta.valor_max;
      }

      if (pregunta.texto) {
        condicionesSubquery.push(`r.valor_texto ILIKE '%' || :texto_${index} || '%'`);
        parametros[`texto_${index}`] = pregunta.texto;
      }

      const joinRespuesta = pregunta.opcion_id ? 'JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id' : '';
      condiciones.push(`EXISTS (SELECT 1 FROM respuestas r ${joinRespuesta} WHERE ${condicionesSubquery.join(' AND ')})`);
    });

    return {
      where: condiciones.join(' AND '),
      parameters: parametros,
    };
  }

  async obtenerDatasetPlano(periodoId: string) {
    return this.obtenerDatasetFiltrado({ periodo_id: periodoId });
  }

  async obtenerDatasetFiltrado(filtros: FiltroReporteDto) {
    const periodo = await this.dataSource.manager.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [filtros.periodo_id],
    );

    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe o está inactivo.');
    }

    const filtro = this.construirCondicionesFiltros(filtros);

    const resultados = await this.dataSource
      .createQueryBuilder()
      .select('u.cedula', 'cedula')
      .addSelect("CONCAT(u.primer_apellido, ' ', COALESCE(u.segundo_apellido, ''))", 'apellidos')
      .addSelect("CONCAT(u.primer_nombre, ' ', COALESCE(u.segundo_nombre, ''))", 'nombres')
      .addSelect('u.email_institucional', 'email')
      .addSelect('c.nombre', 'carrera')
      .addSelect('ci.nombre', 'ciclo')
      .addSelect('f.estado_ficha', 'estado')
      .addSelect('f.total_ingresos', 'ingresos')
      .addSelect('f.total_egresos', 'egresos')
      .addSelect('f.balance_final', 'balance')
      .addSelect("COALESCE(r.nombre, 'Sin Rango')", 'nivel_economico')
      .addSelect(
        `(
          SELECT jsonb_object_agg(
            p.enunciado,
            COALESCE(res.valor_texto, res.valor_numerico::text, '')
          )
          FROM respuestas res
          INNER JOIN preguntas p ON p.id = res.pregunta_id
          WHERE res.ficha_id = f.id AND res.fecha_desactivacion IS NULL
        )`,
        'respuestas_dinamicas',
      )
      .from('fichas_respondidas', 'f')
      .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
      .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
      .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
      .leftJoin('rangos_variable_calculada', 'r', 'r.id = f.rango_resultado_id')
      .where(filtro.where, filtro.parameters)
      .orderBy('c.nombre', 'ASC')
      .addOrderBy('u.primer_apellido', 'ASC')
      .getRawMany();

    return {
      periodo: periodo[0].nombre,
      total_registros: resultados.length,
      datos: resultados,
    };
  }

  async descargarDatasetFiltradoExcel(filtros: FiltroReporteDto, res: Response) {
    const dataset = await this.obtenerDatasetFiltrado(filtros);

    const nombrePeriodo = dataset.periodo.replace(/\s+/g, '_');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Dataset_Filtrado_${nombrePeriodo}.xlsx"`,
      'Transfer-Encoding': 'chunked',
    });

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });

    const hoja = workbook.addWorksheet('Dataset Filtrado', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const clavesDinamicas = new Set<string>();
    dataset.datos.forEach((fila: any) => {
      if (fila.respuestas_dinamicas) Object.keys(fila.respuestas_dinamicas).forEach((k) => clavesDinamicas.add(k));
    });

    hoja.columns = [
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Apellidos', key: 'apellidos', width: 25 },
      { header: 'Nombres', key: 'nombres', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Carrera', key: 'carrera', width: 28 },
      { header: 'Ciclo', key: 'ciclo', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Ingresos', key: 'ingresos', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Egresos', key: 'egresos', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Balance', key: 'balance', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Nivel Económico', key: 'nivel_economico', width: 20 },
      ...Array.from(clavesDinamicas).map((clave) => ({ header: clave, key: clave, width: 22 })),
    ];

    hoja.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    dataset.datos.forEach((fila: any) => {
      hoja.addRow({
        cedula: fila.cedula,
        apellidos: fila.apellidos?.trim(),
        nombres: fila.nombres?.trim(),
        email: fila.email,
        carrera: fila.carrera,
        ciclo: fila.ciclo || 'N/A',
        estado: fila.estado,
        ingresos: Number(fila.ingresos) || 0,
        egresos: Number(fila.egresos) || 0,
        balance: Number(fila.balance) || 0,
        nivel_economico: fila.nivel_economico || 'N/A',
        ...(fila.respuestas_dinamicas || {}),
      }).commit();
    });

    hoja.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
    });

    const getExcelColumnLetter = (index: number): string => {
      let letter = '';
      let value = index;
      while (value > 0) {
        const remainder = (value - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        value = Math.floor((value - 1) / 26);
      }
      return letter;
    };

    const lastColumnLetter = getExcelColumnLetter(hoja.columns.length);
    hoja.autoFilter = { from: 'A1', to: `${lastColumnLetter}1` };

    await workbook.commit();
  }

  async obtenerAgregadoPorPregunta(filtros: FiltroReporteDto) {
    if (filtros.formulario_id) {
      const formulario = await this.dataSource.query(
        `SELECT id, titulo, descripcion, periodo_id FROM formularios WHERE id = $1 AND fecha_desactivacion IS NULL`,
        [filtros.formulario_id],
      );

      if (!formulario || formulario.length === 0) {
        throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
      }
    }

    const estructuraQueryParts = [
      `SELECT 
        s.id AS seccion_id,
        s.nombre AS seccion_nombre,
        s.orden AS seccion_orden,
        p.id AS pregunta_id,
        p.enunciado,
        p.orden AS pregunta_orden,
        t.nombre AS tipo_campo
      FROM secciones s
      INNER JOIN preguntas p ON p.seccion_id = s.id AND p.fecha_desactivacion IS NULL
      INNER JOIN tipos_campo_form t ON t.id = p.tipo_campo_id
      WHERE s.fecha_desactivacion IS NULL`,
    ];
    const estructuraParams: any[] = [];

    if (filtros.formulario_id) {
      estructuraQueryParts.push('AND s.formulario_id = $1');
      estructuraParams.push(filtros.formulario_id);
    }

    estructuraQueryParts.push('ORDER BY s.orden ASC, p.orden ASC');

    const estructuraFormulario = await this.dataSource.query(estructuraQueryParts.join(' '), estructuraParams);
    const filtroGlobal = this.construirCondicionesFiltros(filtros);

    const totalFichasQuery = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(DISTINCT f.id)::int', 'total')
      .from('fichas_respondidas', 'f')
      .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
      .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
      .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
      .where(filtroGlobal.where, filtroGlobal.parameters)
      .getRawOne();

    const totalFichas = totalFichasQuery?.total || 0;
    const reporteEstructurado: any[] = [];

    for (const preg of estructuraFormulario) {
      const tipoCampo = preg.tipo_campo.toUpperCase();
      let metricas: any = null;

      if (tipoCampo.includes('OPCION') || tipoCampo.includes('SELECT') || tipoCampo.includes('CHECKBOX') || tipoCampo.includes('RADIO')) {
        const opcionesConteo = await this.dataSource
          .createQueryBuilder()
          .select('op.id', 'opcion_id')
          .addSelect('op.texto_opcion', 'texto_opcion')
          .addSelect('COUNT(ros.respuesta_id)::int', 'conteo')
          .from('opciones_pregunta', 'op')
          .leftJoin('respuestas_opciones_seleccionadas', 'ros', 'ros.opcion_id = op.id')
          .leftJoin('respuestas', 'r', 'r.id = ros.respuesta_id AND r.pregunta_id = :pregunta_id AND r.fecha_desactivacion IS NULL')
          .leftJoin('fichas_respondidas', 'f', 'f.id = r.ficha_id')
          .leftJoin('usuarios', 'u', 'u.id = f.usuario_id')
          .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
          .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
          .where('op.pregunta_id = :pregunta_id', { pregunta_id: preg.pregunta_id })
          .andWhere('op.fecha_desactivacion IS NULL')
          .andWhere(filtroGlobal.where, filtroGlobal.parameters)
          .groupBy('op.id, op.texto_opcion, op.orden')
          .orderBy('op.orden', 'ASC')
          .setParameter('pregunta_id', preg.pregunta_id)
          .getRawMany();

        metricas = {
          tipo_grafico: 'PIE_O_BARRA',
          opciones: opcionesConteo.map((o: any) => ({
            opcion_id: o.opcion_id,
            texto: o.texto_opcion,
            conteo: o.conteo,
            porcentaje: totalFichas > 0 ? parseFloat(((o.conteo / totalFichas) * 100).toFixed(2)) : 0,
          })),
        };
      } else if (tipoCampo.includes('NUMERIC') || tipoCampo.includes('NUMERO') || tipoCampo.includes('MONEDA')) {
        const numStats = await this.dataSource
          .createQueryBuilder()
          .select('COALESCE(AVG(r.valor_numerico), 0)::float', 'promedio')
          .addSelect('COALESCE(MIN(r.valor_numerico), 0)::float', 'minimo')
          .addSelect('COALESCE(MAX(r.valor_numerico), 0)::float', 'maximo')
          .addSelect('COALESCE(SUM(r.valor_numerico), 0)::float', 'suma')
          .from('respuestas', 'r')
          .innerJoin('fichas_respondidas', 'f', 'f.id = r.ficha_id')
          .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
          .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
          .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
          .where('r.pregunta_id = :pregunta_id', { pregunta_id: preg.pregunta_id })
          .andWhere('r.fecha_desactivacion IS NULL')
          .andWhere(filtroGlobal.where, filtroGlobal.parameters)
          .getRawOne();

        metricas = {
          tipo_grafico: 'METRICA_NUMERICA',
          promedio: parseFloat((numStats?.promedio || 0).toFixed(2)),
          minimo: numStats?.minimo || 0,
          maximo: numStats?.maximo || 0,
          suma: numStats?.suma || 0,
        };
      } else if (tipoCampo.includes('MATRIZ')) {
        const matrizConteo = await this.dataSource
          .createQueryBuilder()
          .select('rm.fila_id', 'fila_id')
          .addSelect('fm.texto_fila', 'texto_fila')
          .addSelect('rm.columna_id', 'columna_id')
          .addSelect('cm.texto_columna', 'texto_columna')
          .addSelect('COUNT(rm.respuesta_id)::int', 'conteo')
          .from('respuestas_matriz', 'rm')
          .innerJoin('filas_matriz', 'fm', 'fm.id = rm.fila_id')
          .innerJoin('columnas_matriz', 'cm', 'cm.id = rm.columna_id')
          .innerJoin('respuestas', 'r', 'r.id = rm.respuesta_id AND r.pregunta_id = :pregunta_id AND r.fecha_desactivacion IS NULL')
          .innerJoin('fichas_respondidas', 'f', 'f.id = r.ficha_id')
          .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
          .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
          .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
          .where(filtroGlobal.where, filtroGlobal.parameters)
          .groupBy('rm.fila_id, fm.texto_fila, rm.columna_id, cm.texto_columna')
          .setParameter('pregunta_id', preg.pregunta_id)
          .getRawMany();

        metricas = {
          tipo_grafico: 'MATRIZ_AGREGADA',
          matriz_respuestas: matrizConteo,
        };
      } else {
        const totalRespuestasTexto = await this.dataSource
          .createQueryBuilder()
          .select('COUNT(r.id)::int', 'conteo')
          .from('respuestas', 'r')
          .innerJoin('fichas_respondidas', 'f', 'f.id = r.ficha_id')
          .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
          .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
          .leftJoin('ciclos', 'ci', 'ci.id = u.ciclo_id')
          .where('r.pregunta_id = :pregunta_id', { pregunta_id: preg.pregunta_id })
          .andWhere('r.valor_texto IS NOT NULL')
          .andWhere('r.fecha_desactivacion IS NULL')
          .andWhere(filtroGlobal.where, filtroGlobal.parameters)
          .getRawOne();

        metricas = {
          tipo_grafico: 'TEXTO_LIBRE',
          total_respuestas: totalRespuestasTexto?.conteo || 0,
        };
      }

      reporteEstructurado.push({
        seccion_id: preg.seccion_id,
        seccion_nombre: preg.seccion_nombre,
        pregunta_id: preg.pregunta_id,
        enunciado: preg.enunciado,
        tipo_campo: preg.tipo_campo,
        metricas,
      });
    }

    return {
      total_fichas_respondidas: totalFichas,
      estructura_agregada: reporteEstructurado,
    };
  }


  async generarReporteFiltradoPdf(filtros: FiltroReporteDto) {
  const dataset = await this.obtenerDatasetFiltrado(filtros);
  const agregado = await this.obtenerAgregadoPorPregunta(filtros);

  const filtrosParaPdf: Record<string, any> = {
    estado_ficha: filtros.estado_ficha || null,
    formulario_nombre: 'Todos',
    carrera_nombre: 'Todas',
    ciclo_nombre: 'Todos',
  };

  if (filtros.formulario_id) {
    const formRows = await this.dataSource.query(
      `SELECT titulo FROM formularios WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [filtros.formulario_id],
    );
    filtrosParaPdf.formulario_nombre = formRows?.[0]?.titulo || filtros.formulario_id;
  }

  if (filtros.carrera_id) {
    const carreraRows = await this.dataSource.query(
      `SELECT nombre FROM carreras WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [filtros.carrera_id],
    );
    filtrosParaPdf.carrera_nombre = carreraRows?.[0]?.nombre || filtros.carrera_id;
  }

  if (filtros.ciclo_id) {
    const cicloRows = await this.dataSource.query(
      `SELECT nombre FROM ciclos WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [filtros.ciclo_id],
    );
    filtrosParaPdf.ciclo_nombre = cicloRows?.[0]?.nombre || filtros.ciclo_id;
  }

  const templatePath = path.join(
    process.cwd(),
    process.env.NODE_ENV === 'production'
      ? 'dist/common/pdf/templates/reporte-consolidado.hbs'
      : 'src/common/pdf/templates/reporte-consolidado.hbs',
  );

  const source = readFileSync(templatePath, 'utf-8');
  const template = this.pdfRendererService.compilarTemplate('reporte-consolidado', source);

  const html = template({
    filtros: filtrosParaPdf,
    periodo: dataset.periodo,
    total_registros: dataset.total_registros,
    dataset: dataset.datos.slice(0, 50),
    total_fichas_respondidas: agregado.total_fichas_respondidas,
    // estructura_agregada eliminada → ya no se genera la sección IV
    generated_at: new Date().toLocaleString('es-EC'),
  });

  return this.pdfRendererService.renderizarHtmlAPdf(html);
}

  /**
   * @deprecated Use obtenerDatasetFiltrado instead.
   */
  async obtenerDatasetPlanoAntiguo(periodoId: string) {
    const periodo = await this.dataSource.manager.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [periodoId],
    );

    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe o está inactivo.');
    }

    const query = `
      SELECT
        u.cedula AS "cedula",
        CONCAT(u.primer_apellido, ' ', COALESCE(u.segundo_apellido, '')) AS "apellidos",
        CONCAT(u.primer_nombre, ' ', COALESCE(u.segundo_nombre, '')) AS "nombres",
        u.email_institucional AS "email",
        c.nombre AS "carrera",
        f.estado_ficha AS "estado",
        f.total_ingresos AS "ingresos",
        f.total_egresos AS "egresos",
        f.balance_final AS "balance",
        COALESCE(r.nombre, 'Sin Rango') AS "nivel_economico",
        
        (
          SELECT jsonb_object_agg(
            p.enunciado,
            COALESCE(res.valor_texto, res.valor_numerico::text, '')
          )
          FROM respuestas res
          INNER JOIN preguntas p ON p.id = res.pregunta_id
          WHERE res.ficha_id = f.id AND res.fecha_desactivacion IS NULL
        ) AS "respuestas_dinamicas"
        
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN rangos_variable_calculada r ON r.id = f.rango_resultado_id
      WHERE f.periodo_id = $1 AND f.fecha_desactivacion IS NULL
      ORDER BY c.nombre ASC, u.primer_apellido ASC
    `;

    const resultados = await this.dataSource.query(query, [periodoId]);

    return {
      periodo: periodo[0].nombre,
      total_registros: resultados.length,
      datos: resultados,
    };
  }

  /**
   * Obtiene la lista de formularios de un periodo para alimentar el dropdown del dashboard.
   */
  async obtenerFormulariosDisponibles(periodoId: string) {
    return this.dataSource.query(
      `
      SELECT id, titulo, descripcion, publicado, fecha_publicacion, version
      FROM formularios
      WHERE periodo_id = $1 AND fecha_desactivacion IS NULL
      ORDER BY version DESC, created_at DESC
      `,
      [periodoId],
    );
  }

  /**
   * Genera el archivo Excel profesional de la matriz socioeconómica del periodo.
   */
  async generarMatrizSocioeconomicaExcel(periodoId: string): Promise<{ buffer: Buffer; nombrePeriodo: string }> {
    const dataset = await this.obtenerDatasetPlano(periodoId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AzuayCare';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Matriz Socioeconómica', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const clavesDinamicas = new Set<string>();
    dataset.datos.forEach((fila: any) => {
      if (fila.respuestas_dinamicas) Object.keys(fila.respuestas_dinamicas).forEach((k) => clavesDinamicas.add(k));
    });

    hoja.columns = [
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Apellidos', key: 'apellidos', width: 25 },
      { header: 'Nombres', key: 'nombres', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Carrera', key: 'carrera', width: 28 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Ingresos', key: 'ingresos', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Egresos', key: 'egresos', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Balance', key: 'balance', width: 14, style: { numFmt: '$#,##0.00' } },
      { header: 'Nivel Económico', key: 'nivel_economico', width: 20 },
      ...Array.from(clavesDinamicas).map((clave) => ({ header: clave, key: clave, width: 22 })),
    ];

    hoja.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    dataset.datos.forEach((fila: any) => {
      hoja.addRow({
        cedula: fila.cedula,
        apellidos: fila.apellidos?.trim(),
        nombres: fila.nombres?.trim(),
        email: fila.email,
        carrera: fila.carrera,
        estado: fila.estado,
        ingresos: Number(fila.ingresos) || 0,
        egresos: Number(fila.egresos) || 0,
        balance: Number(fila.balance) || 0,
        nivel_economico: fila.nivel_economico || 'N/A',
        ...(fila.respuestas_dinamicas || {}),
      });
    });

    hoja.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
    });

    hoja.autoFilter = { from: 'A1', to: `${String.fromCharCode(65 + hoja.columns.length - 1)}1` };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(arrayBuffer), nombrePeriodo: dataset.periodo };
  }

  /**
   * Estadísticas agregadas del periodo para el dashboard de reportes.
   */
  async obtenerEstadisticasPeriodo(periodoId: string) {
    const periodo = await this.dataSource.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [periodoId],
    );
    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe o está inactivo.');
    }

    const totales = await this.dataSource.query(
      `
      SELECT 
        COUNT(*)::int AS total_fichas, 
        COUNT(*) FILTER (WHERE estado_ficha = 'BORRADOR')::int AS fichas_borrador, 
        COUNT(*) FILTER (WHERE estado_ficha IN ('ENVIADA','ENVIADO'))::int AS fichas_enviadas, 
        COUNT(*) FILTER (WHERE estado_ficha = 'VALIDADO')::int AS fichas_validadas, 
        COUNT(*) FILTER (WHERE estado_ficha = 'RECHAZADA')::int AS fichas_rechazadas 
      FROM fichas_respondidas 
      WHERE periodo_id = $1 AND fecha_desactivacion IS NULL
      `,
      [periodoId],
    );

    const distribucion = await this.dataSource.query(
      `
      SELECT COALESCE(r.nombre, 'Sin Rango') AS rango_nombre, COUNT(f.id)::int AS total 
      FROM fichas_respondidas f 
      LEFT JOIN rangos_variable_calculada r ON r.id = f.rango_resultado_id 
      WHERE f.periodo_id = $1 AND f.fecha_desactivacion IS NULL 
      GROUP BY r.nombre 
      ORDER BY total DESC
      `,
      [periodoId],
    );

    return {
      ...totales[0],
      distribucion_rangos: distribucion,
    };
  }

  /**
   * Descarga optimizada en streaming para datasets grandes.
   */
  async descargarExcelStream(periodoId: string, res: Response) {
    const periodo = await this.dataSource.manager.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [periodoId],
    );

    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe.');
    }

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet('Dataset Plano');

    worksheet.columns = [
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Apellidos', key: 'apellidos', width: 25 },
      { header: 'Nombres', key: 'nombres', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Carrera', key: 'carrera', width: 30 },
      { header: 'Estado Ficha', key: 'estado', width: 15 },
      { header: 'Total Ingresos', key: 'ingresos', width: 15 },
      { header: 'Total Egresos', key: 'egresos', width: 15 },
      { header: 'Balance', key: 'balance', width: 15 },
      { header: 'Nivel Económico', key: 'nivel_economico', width: 25 },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const query = `
      SELECT
        u.cedula AS "cedula",
        CONCAT(u.primer_apellido, ' ', COALESCE(u.segundo_apellido, '')) AS "apellidos",
        CONCAT(u.primer_nombre, ' ', COALESCE(u.segundo_nombre, '')) AS "nombres",
        u.email_institucional AS "email",
        c.nombre AS "carrera",
        f.estado_ficha AS "estado",
        f.total_ingresos AS "ingresos",
        f.total_egresos AS "egresos",
        f.balance_final AS "balance",
        COALESCE(r.nombre, 'Sin Rango') AS "nivel_economico"
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN rangos_variable_calculada r ON r.id = f.rango_resultado_id
      WHERE f.periodo_id = $1 AND f.fecha_desactivacion IS NULL
      ORDER BY c.nombre ASC, u.primer_apellido ASC
    `;

    const dbStream = await queryRunner.stream(query, [periodoId]);

    dbStream.on('data', (row) => {
      worksheet.addRow(row).commit();
    });

    dbStream.on('end', async () => {
      await workbook.commit();
      await queryRunner.release();
    });

    dbStream.on('error', async (error) => {
      console.error('Error generando stream de Excel:', error);
      await queryRunner.release();
      if (!res.headersSent) {
        res.status(500).send('Error interno generando el reporte Excel.');
      }
    });
  }
}