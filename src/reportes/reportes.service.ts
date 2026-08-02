import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportesService {
  constructor(private readonly dataSource: DataSource) {}

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

    // 3. Gráfico de Pastel (Niveles Económicos)
    const nivelesData = await this.dataSource.query(
      `SELECT n.nombre as label, COUNT(f.id)::int as total
       FROM fichas_respondidas f
       INNER JOIN niveles_economicos n ON n.id = f.nivel_economico_id
       WHERE f.fecha_desactivacion IS NULL
       GROUP BY n.nombre`
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
          data: nivelesData.map((n: any) => n.total)
        },
        fichasPorCarrera: {
          labels: carrerasData.map((c: any) => c.carrera),
          enviadas: carrerasData.map((c: any) => c.enviadas),
          validadas: carrerasData.map((c: any) => c.validadas)
        }
      }
    };
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

  /**
   * Dataset plano fila por fila para alimentar la tabla dinámica y los filtros cruzados del frontend.
   */
  async obtenerDatasetPlano(periodoId: string) {
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
        n.nombre AS "nivel_economico",
        
        (
          SELECT jsonb_object_agg(
            p.enunciado,
            COALESCE(r.valor_texto, r.valor_numerico::text, '')
          )
          FROM respuestas r
          INNER JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.ficha_id = f.id AND r.fecha_desactivacion IS NULL
        ) AS "respuestas_dinamicas"
        
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN niveles_economicos n ON n.id = f.nivel_economico_id
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
      SELECT n.nombre AS rango_nombre, COUNT(f.id)::int AS total 
      FROM fichas_respondidas f 
      INNER JOIN niveles_economicos n ON n.id = f.nivel_economico_id 
      WHERE f.periodo_id = $1 AND f.fecha_desactivacion IS NULL 
      GROUP BY n.nombre 
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
        n.nombre AS "nivel_economico"
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN niveles_economicos n ON n.id = f.nivel_economico_id
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