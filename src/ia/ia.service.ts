import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
};

export type IaChatResult = {
  response: string;
  fuentes: Array<{
    tool: string;
    args?: any;
    filas?: number;
    consultado_en: string;
  }>;
};

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly url = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  // Sube el límite de idas y vueltas con el modelo para permitir preguntas
  // que requieren encadenar varias tools (ej: comparar carrera + periodo + alertas)
  private readonly MAX_TOOL_ROUNDS = 6;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
  ) {}

  // ===================== TOOLS (lo que la IA puede pedir) =====================

  private readonly tools = [
    {
      type: 'function',
      function: {
        name: 'resumen_general',
        description: 'Totales del sistema: fichas, enviadas, validadas, carreras, formularios, periodo activo.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_por_estado',
        description: 'Conteo de fichas por estado_ficha.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_por_carrera',
        description: 'Conteo de fichas enviadas y validadas por carrera.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_con_alertas',
        description: 'Fichas con alertas de vulnerabilidad (revision_manual_obligatoria + respuesta afirmativa).',
        parameters: {
          type: 'object',
          properties: {
            solo_conteo: { type: 'boolean', description: 'Solo número total' },
            limite: { type: 'number', description: 'Máx. filas a listar (default 20)' },
            carrera: { type: 'string', description: 'Filtrar por nombre (o parte del nombre) de carrera' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'alertas_por_pregunta',
        description: 'Cuántas respuestas afirmativas hay por cada pregunta de revisión manual.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buscar_estudiante',
        description: 'Busca estudiante por cédula, nombre, apellido o email y su ficha.',
        parameters: {
          type: 'object',
          properties: {
            termino: { type: 'string', description: 'Texto de búsqueda' },
          },
          required: ['termino'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'detalle_alertas_ficha',
        description: 'Detalle de alertas de una ficha por cédula o ficha_id.',
        parameters: {
          type: 'object',
          properties: {
            cedula: { type: 'string' },
            ficha_id: { type: 'string' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'listar_fichas_recientes',
        description: 'Últimas fichas no borrador (estudiante, carrera, estado, fechas).',
        parameters: {
          type: 'object',
          properties: {
            estado: {
              type: 'string',
              description: 'Filtrar por estado (ENVIADA, VALIDADO, RECHAZADA) o TODOS',
            },
            limite: { type: 'number', description: 'Default 15, máx 40' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'resumen_economico',
        description: 'Promedios de ingresos, egresos y balance de fichas activas no borrador.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'listar_periodos',
        description: 'Periodos de matrícula y cuál está activo.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'listar_formularios',
        description: 'Formularios publicados/activos con periodo.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'listar_carreras',
        description: 'Carreras activas del instituto.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    // ---------- NUEVAS TOOLS ----------
    {
      type: 'function',
      function: {
        name: 'evolucion_fichas_por_dia',
        description:
          'Serie temporal: cuántas fichas se crearon/enviaron por día en un rango de fechas. Útil para ver tendencias.',
        parameters: {
          type: 'object',
          properties: {
            dias: { type: 'number', description: 'Cuántos días hacia atrás desde hoy (default 30, máx 180)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'comparar_periodos',
        description:
          'Compara totales de fichas (enviadas, validadas, con alertas) entre todos los periodos de matrícula registrados.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'alertas_por_carrera',
        description: 'Cuántas fichas con alertas hay por cada carrera, con porcentaje sobre el total de esa carrera.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_pendientes_revision',
        description:
          'Fichas en estado ENVIADA que llevan más tiempo esperando validación (para priorizar revisión manual).',
        parameters: {
          type: 'object',
          properties: {
            limite: { type: 'number', description: 'Default 20, máx 50' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'top_egresos_ingresos',
        description:
          'Fichas con los ingresos o egresos más altos/bajos, útil para detectar casos económicos extremos.',
        parameters: {
          type: 'object',
          properties: {
            campo: { type: 'string', description: "'ingresos' o 'egresos'" },
            orden: { type: 'string', description: "'mayor' o 'menor'" },
            limite: { type: 'number', description: 'Default 10, máx 30' },
          },
          required: ['campo'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'alertas_por_carrera_y_periodo',
        description:
          'Cruce de vulnerabilidad por carrera Y por periodo de matrícula en una sola consulta: cuántas fichas con alertas tiene cada carrera en cada periodo, con porcentaje. Usar SIEMPRE que la pregunta combine "carrera" con "periodo(s) anterior(es)", "comparar periodos", "evolución por carrera", etc. — evita tener que cruzar manualmente alertas_por_carrera con comparar_periodos.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
  ];

  // ===================== EJECUTORES DE TOOLS =====================

  private async ejecutarTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'resumen_general':
        return this.toolResumenGeneral();
      case 'fichas_por_estado':
        return this.toolFichasPorEstado();
      case 'fichas_por_carrera':
        return this.toolFichasPorCarrera();
      case 'fichas_con_alertas':
        return this.toolFichasConAlertas(args);
      case 'alertas_por_pregunta':
        return this.toolAlertasPorPregunta();
      case 'buscar_estudiante':
        return this.toolBuscarEstudiante(args.termino);
      case 'detalle_alertas_ficha':
        return this.toolDetalleAlertas(args);
      case 'listar_fichas_recientes':
        return this.toolListarFichasRecientes(args);
      case 'resumen_economico':
        return this.toolResumenEconomico();
      case 'listar_periodos':
        return this.toolListarPeriodos();
      case 'listar_formularios':
        return this.toolListarFormularios();
      case 'listar_carreras':
        return this.toolListarCarreras();
      case 'evolucion_fichas_por_dia':
        return this.toolEvolucionFichasPorDia(args);
      case 'comparar_periodos':
        return this.toolCompararPeriodos();
      case 'alertas_por_carrera':
        return this.toolAlertasPorCarrera();
      case 'fichas_pendientes_revision':
        return this.toolFichasPendientesRevision(args);
      case 'top_egresos_ingresos':
        return this.toolTopEgresosIngresos(args);
      case 'alertas_por_carrera_y_periodo':
        return this.toolAlertasPorCarreraYPeriodo();
      default:
        return { error: `Tool desconocida: ${name}` };
    }
  }

  private async toolResumenGeneral() {
    const [periodo] = await this.dataSource.query(`
      SELECT id, nombre, fecha_inicio, fecha_fin
      FROM periodos_matricula
      WHERE activo = true AND fecha_desactivacion IS NULL
      LIMIT 1
    `);

    const [totales] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM fichas_respondidas WHERE fecha_desactivacion IS NULL) AS total_fichas,
        (SELECT COUNT(*)::int FROM fichas_respondidas WHERE fecha_desactivacion IS NULL AND estado_ficha IN ('ENVIADA','ENVIADO')) AS enviadas,
        (SELECT COUNT(*)::int FROM fichas_respondidas WHERE fecha_desactivacion IS NULL AND estado_ficha = 'VALIDADO') AS validadas,
        (SELECT COUNT(*)::int FROM carreras WHERE fecha_desactivacion IS NULL) AS carreras,
        (SELECT COUNT(*)::int FROM formularios WHERE fecha_desactivacion IS NULL) AS formularios
    `);

    return { periodo_activo: periodo || null, ...totales };
  }

  private async toolFichasPorEstado() {
    return this.dataSource.query(`
      SELECT estado_ficha, COUNT(*)::int AS total
      FROM fichas_respondidas
      WHERE fecha_desactivacion IS NULL
      GROUP BY estado_ficha
      ORDER BY total DESC
    `);
  }

  private async toolFichasConAlertas(args: { solo_conteo?: boolean; limite?: number; carrera?: string }) {
    const limite = Math.min(Number(args?.limite) || 20, 50);
    const carreraFiltro = args?.carrera ? `%${String(args.carrera).trim().toLowerCase()}%` : null;

    if (args?.solo_conteo) {
      const [row] = await this.dataSource.query(
        `
        WITH Alertas AS (
          SELECT r.ficha_id
          FROM respuestas r
          INNER JOIN preguntas p ON p.id = r.pregunta_id
          LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
          LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
          WHERE r.fecha_desactivacion IS NULL
            AND p.fecha_desactivacion IS NULL
            AND p.revision_manual_obligatoria = true
            AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
                NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
          GROUP BY r.ficha_id
        )
        SELECT COUNT(*)::int AS total_con_alertas
        FROM fichas_respondidas f
        INNER JOIN Alertas a ON a.ficha_id = f.id
        INNER JOIN usuarios u ON u.id = f.usuario_id
        LEFT JOIN carreras c ON c.id = u.carrera_id
        WHERE f.fecha_desactivacion IS NULL
          AND f.estado_ficha != 'BORRADOR'
          AND ($1::text IS NULL OR LOWER(c.nombre) LIKE $1)
      `,
        [carreraFiltro],
      );
      return row;
    }

    return this.dataSource.query(
      `
      WITH Alertas AS (
        SELECT r.ficha_id, COUNT(*)::int AS total_alertas
        FROM respuestas r
        INNER JOIN preguntas p ON p.id = r.pregunta_id
        LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
        LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
        WHERE r.fecha_desactivacion IS NULL
          AND p.fecha_desactivacion IS NULL
          AND p.revision_manual_obligatoria = true
          AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
              NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
        GROUP BY r.ficha_id
      )
      SELECT
        f.id AS ficha_id,
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        c.nombre AS carrera,
        f.estado_ficha,
        a.total_alertas
      FROM Alertas a
      INNER JOIN fichas_respondidas f ON f.id = a.ficha_id
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      WHERE f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
        AND ($2::text IS NULL OR LOWER(c.nombre) LIKE $2)
      ORDER BY a.total_alertas DESC
      LIMIT $1
    `,
      [limite, carreraFiltro],
    );
  }

  private async toolBuscarEstudiante(termino: string) {
    const term = `%${String(termino || '').trim().toLowerCase()}%`;
    return this.dataSource.query(
      `
      SELECT
        u.cedula,
        u.primer_nombre || ' ' || COALESCE(u.segundo_nombre, '') || ' ' || u.primer_apellido AS nombre,
        c.nombre AS carrera,
        f.id AS ficha_id,
        f.estado_ficha,
        f.total_ingresos,
        f.total_egresos,
        f.balance_final,
        f.created_at
      FROM usuarios u
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN fichas_respondidas f ON f.usuario_id = u.id AND f.fecha_desactivacion IS NULL
      WHERE u.fecha_desactivacion IS NULL
        AND (
          LOWER(u.cedula) LIKE $1
          OR LOWER(u.primer_nombre) LIKE $1
          OR LOWER(u.primer_apellido) LIKE $1
          OR LOWER(u.email_institucional) LIKE $1
        )
      ORDER BY f.created_at DESC NULLS LAST
      LIMIT 15
    `,
      [term],
    );
  }

  private async toolDetalleAlertas(args: { cedula?: string; ficha_id?: string }) {
    if (!args?.cedula && !args?.ficha_id) {
      return { error: 'Debes indicar cedula o ficha_id' };
    }

    return this.dataSource.query(
      `
      SELECT
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        p.enunciado AS pregunta,
        COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text) AS respuesta
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      INNER JOIN fichas_respondidas f ON f.id = r.ficha_id
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND p.revision_manual_obligatoria = true
        AND f.fecha_desactivacion IS NULL
        AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
            NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
        AND (
          ($1::text IS NOT NULL AND u.cedula = $1)
          OR ($2::uuid IS NOT NULL AND f.id = $2::uuid)
        )
      ORDER BY p.enunciado
    `,
      [args.cedula || null, args.ficha_id || null],
    );
  }

  private async toolAlertasPorPregunta() {
    return this.dataSource.query(`
      SELECT
        p.enunciado AS pregunta,
        COUNT(*)::int AS total_respuestas_afirmativas
      FROM respuestas r
      INNER JOIN preguntas p ON p.id = r.pregunta_id
      LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
      LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
      INNER JOIN fichas_respondidas f ON f.id = r.ficha_id
      WHERE r.fecha_desactivacion IS NULL
        AND p.fecha_desactivacion IS NULL
        AND f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
        AND p.revision_manual_obligatoria = true
        AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
            NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
      GROUP BY p.enunciado
      ORDER BY total_respuestas_afirmativas DESC
    `);
  }

  private async toolFichasPorCarrera() {
    return this.dataSource.query(`
      SELECT
        COALESCE(c.nombre, 'Sin carrera') AS carrera,
        COUNT(f.id) FILTER (WHERE f.estado_ficha IN ('ENVIADA', 'ENVIADO'))::int AS enviadas,
        COUNT(f.id) FILTER (WHERE f.estado_ficha = 'VALIDADO')::int AS validadas,
        COUNT(f.id) FILTER (WHERE f.estado_ficha != 'BORRADOR')::int AS total
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      WHERE f.fecha_desactivacion IS NULL
      GROUP BY c.nombre
      ORDER BY total DESC
    `);
  }

  private async toolListarFichasRecientes(args: { estado?: string; limite?: number }) {
    const limite = Math.min(Number(args?.limite) || 15, 40);
    const estado = (args?.estado || 'TODOS').toUpperCase();

    if (estado && estado !== 'TODOS') {
      return this.dataSource.query(
        `
        SELECT
          f.id AS ficha_id,
          u.cedula,
          u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
          c.nombre AS carrera,
          f.estado_ficha,
          f.created_at,
          f.updated_at
        FROM fichas_respondidas f
        INNER JOIN usuarios u ON u.id = f.usuario_id
        LEFT JOIN carreras c ON c.id = u.carrera_id
        WHERE f.fecha_desactivacion IS NULL
          AND f.estado_ficha = $1
        ORDER BY f.updated_at DESC
        LIMIT $2
      `,
        [estado, limite],
      );
    }

    return this.dataSource.query(
      `
      SELECT
        f.id AS ficha_id,
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        c.nombre AS carrera,
        f.estado_ficha,
        f.created_at,
        f.updated_at
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      WHERE f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
      ORDER BY f.updated_at DESC
      LIMIT $1
    `,
      [limite],
    );
  }

  private async toolResumenEconomico() {
    const [row] = await this.dataSource.query(`
      SELECT
        COUNT(*)::int AS fichas_consideradas,
        ROUND(AVG(total_ingresos)::numeric, 2) AS promedio_ingresos,
        ROUND(AVG(total_egresos)::numeric, 2) AS promedio_egresos,
        ROUND(AVG(balance_final)::numeric, 2) AS promedio_balance,
        ROUND(SUM(total_ingresos)::numeric, 2) AS suma_ingresos,
        ROUND(SUM(total_egresos)::numeric, 2) AS suma_egresos
      FROM fichas_respondidas
      WHERE fecha_desactivacion IS NULL
        AND estado_ficha != 'BORRADOR'
    `);
    return row;
  }

  private async toolListarPeriodos() {
    return this.dataSource.query(`
      SELECT id, nombre, fecha_inicio, fecha_fin, activo
      FROM periodos_matricula
      WHERE fecha_desactivacion IS NULL
      ORDER BY fecha_inicio DESC
    `);
  }

  private async toolListarFormularios() {
    return this.dataSource.query(`
      SELECT
        f.id,
        f.titulo,
        f.publicado,
        p.nombre AS periodo
      FROM formularios f
      LEFT JOIN periodos_matricula p ON p.id = f.periodo_id
      WHERE f.fecha_desactivacion IS NULL
      ORDER BY f.created_at DESC
      LIMIT 30
    `);
  }

  private async toolListarCarreras() {
    return this.dataSource.query(`
      SELECT id, nombre
      FROM carreras
      WHERE fecha_desactivacion IS NULL
      ORDER BY nombre ASC
    `);
  }

  // ---------- NUEVOS EJECUTORES ----------

  private async toolEvolucionFichasPorDia(args: { dias?: number }) {
    const dias = Math.min(Number(args?.dias) || 30, 180);
    return this.dataSource.query(
      `
      SELECT
        DATE(created_at) AS dia,
        COUNT(*)::int AS fichas_creadas,
        COUNT(*) FILTER (WHERE estado_ficha != 'BORRADOR')::int AS fichas_enviadas
      FROM fichas_respondidas
      WHERE fecha_desactivacion IS NULL
        AND created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY DATE(created_at)
      ORDER BY dia ASC
    `,
      [dias],
    );
  }

  private async toolCompararPeriodos() {
    return this.dataSource.query(`
      WITH Alertas AS (
        SELECT r.ficha_id
        FROM respuestas r
        INNER JOIN preguntas p ON p.id = r.pregunta_id
        LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
        LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
        WHERE r.fecha_desactivacion IS NULL
          AND p.fecha_desactivacion IS NULL
          AND p.revision_manual_obligatoria = true
          AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
              NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
        GROUP BY r.ficha_id
      )
      SELECT
        pm.nombre AS periodo,
        pm.activo,
        COUNT(fo.id) FILTER (WHERE fo.estado_ficha IN ('ENVIADA','ENVIADO'))::int AS enviadas,
        COUNT(fo.id) FILTER (WHERE fo.estado_ficha = 'VALIDADO')::int AS validadas,
        COUNT(DISTINCT a.ficha_id)::int AS con_alertas
      FROM periodos_matricula pm
      LEFT JOIN formularios fr ON fr.periodo_id = pm.id AND fr.fecha_desactivacion IS NULL
      LEFT JOIN fichas_respondidas fo ON fo.formulario_id = fr.id AND fo.fecha_desactivacion IS NULL AND fo.estado_ficha != 'BORRADOR'
      LEFT JOIN Alertas a ON a.ficha_id = fo.id
      WHERE pm.fecha_desactivacion IS NULL
      GROUP BY pm.nombre, pm.activo, pm.fecha_inicio
      ORDER BY pm.fecha_inicio DESC
    `);
  }

  private async toolAlertasPorCarrera() {
    return this.dataSource.query(`
      WITH Alertas AS (
        SELECT r.ficha_id
        FROM respuestas r
        INNER JOIN preguntas p ON p.id = r.pregunta_id
        LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
        LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
        WHERE r.fecha_desactivacion IS NULL
          AND p.fecha_desactivacion IS NULL
          AND p.revision_manual_obligatoria = true
          AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
              NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
        GROUP BY r.ficha_id
      )
      SELECT
        COALESCE(c.nombre, 'Sin carrera') AS carrera,
        COUNT(f.id) FILTER (WHERE f.estado_ficha != 'BORRADOR')::int AS total_fichas,
        COUNT(DISTINCT a.ficha_id)::int AS con_alertas,
        ROUND(
          100.0 * COUNT(DISTINCT a.ficha_id) / NULLIF(COUNT(f.id) FILTER (WHERE f.estado_ficha != 'BORRADOR'), 0),
          1
        ) AS porcentaje_con_alertas
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN Alertas a ON a.ficha_id = f.id
      WHERE f.fecha_desactivacion IS NULL
      GROUP BY c.nombre
      ORDER BY con_alertas DESC
    `);
  }

  private async toolFichasPendientesRevision(args: { limite?: number }) {
    const limite = Math.min(Number(args?.limite) || 20, 50);
    return this.dataSource.query(
      `
      SELECT
        f.id AS ficha_id,
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        c.nombre AS carrera,
        f.created_at,
        EXTRACT(DAY FROM NOW() - f.created_at)::int AS dias_esperando
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      WHERE f.fecha_desactivacion IS NULL
        AND f.estado_ficha IN ('ENVIADA', 'ENVIADO')
      ORDER BY f.created_at ASC
      LIMIT $1
    `,
      [limite],
    );
  }

  private async toolTopEgresosIngresos(args: { campo?: string; orden?: string; limite?: number }) {
    const campo = args?.campo === 'egresos' ? 'total_egresos' : 'total_ingresos';
    const orden = args?.orden === 'menor' ? 'ASC' : 'DESC';
    const limite = Math.min(Number(args?.limite) || 10, 30);

    return this.dataSource.query(
      `
      SELECT
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        c.nombre AS carrera,
        f.total_ingresos,
        f.total_egresos,
        f.balance_final
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      WHERE f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
      ORDER BY f.${campo} ${orden} NULLS LAST
      LIMIT $1
    `,
      [limite],
    );
  }

  private async toolAlertasPorCarreraYPeriodo() {
    return this.dataSource.query(`
      WITH Alertas AS (
        SELECT r.ficha_id
        FROM respuestas r
        INNER JOIN preguntas p ON p.id = r.pregunta_id
        LEFT JOIN respuestas_opciones_seleccionadas ros ON ros.respuesta_id = r.id
        LEFT JOIN opciones_pregunta op ON op.id = ros.opcion_id
        WHERE r.fecha_desactivacion IS NULL
          AND p.fecha_desactivacion IS NULL
          AND p.revision_manual_obligatoria = true
          AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, ''))
              NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
        GROUP BY r.ficha_id
      )
      SELECT
        pm.nombre AS periodo,
        pm.fecha_inicio,
        pm.activo AS periodo_activo,
        COALESCE(c.nombre, 'Sin carrera') AS carrera,
        COUNT(f.id) FILTER (WHERE f.estado_ficha != 'BORRADOR')::int AS total_fichas,
        COUNT(DISTINCT a.ficha_id)::int AS con_alertas,
        ROUND(
          100.0 * COUNT(DISTINCT a.ficha_id) / NULLIF(COUNT(f.id) FILTER (WHERE f.estado_ficha != 'BORRADOR'), 0),
          1
        ) AS porcentaje_con_alertas
      FROM periodos_matricula pm
      INNER JOIN formularios fr ON fr.periodo_id = pm.id AND fr.fecha_desactivacion IS NULL
      INNER JOIN fichas_respondidas f ON f.formulario_id = fr.id AND f.fecha_desactivacion IS NULL
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN Alertas a ON a.ficha_id = f.id
      WHERE pm.fecha_desactivacion IS NULL
      GROUP BY pm.nombre, pm.fecha_inicio, pm.activo, c.nombre
      ORDER BY pm.fecha_inicio DESC, con_alertas DESC
    `);
  }

  // ===================== ORQUESTACIÓN CON GROQ =====================

  async procesarMensaje(prompt: string): Promise<IaChatResult> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GROQ_API_KEY no configurada');
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const fuentes: IaChatResult['fuentes'] = [];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Eres el asistente interno de Bienestar Estudiantil de AzuayCare (IST del Azuay).

Reglas de datos:
- Para cualquier dato del sistema USA las herramientas disponibles. Nunca inventes cifras, nombres o UUIDs.
- Cada pregunta debe resolverse COMPLETA en este mismo turno: si necesitas combinar información (ej: carrera + alertas + periodo, o estudiante + detalle de alertas), llama TODAS las tools necesarias en secuencia antes de responder. No entregues una respuesta parcial esperando que te pregunten el resto.
- REGLA CLAVE: cuando tu respuesta mencione a una persona/ficha específica (por prioridad, alerta, búsqueda, etc.), SIEMPRE complementa con sus datos completos llamando a 'buscar_estudiante' y/o 'detalle_alertas_ficha' en el mismo turno, aunque el usuario no lo haya pedido explícitamente. No dejes una respuesta con solo el nombre y una frase genérica.
- Si la pregunta compara periodos o pide evolución, usa 'alertas_por_carrera_y_periodo' o 'comparar_periodos' según corresponda, en vez de intentar deducirlo con datos parciales de una sola tool.
- Si una tool no devuelve filas o el dato no existe, dilo explícitamente en vez de omitirlo.
- No expongas UUIDs salvo que te los pidan explícitamente.

Reglas de respuesta (IMPORTANTE, sé exhaustivo):
- Responde siempre en español, con tono claro y profesional, pero desarrollado y completo.
- Cuando hables de una persona específica, incluye: nombre completo, cédula, carrera, estado de la ficha, y el detalle de CADA pregunta/alerta con su respuesta exacta (no solo "tiene una condición que requiere revisión" — di CUÁL condición, según los datos de detalle_alertas_ficha).
- Cuando haya varias filas de resultados, organízalas en una lista o tabla markdown legible, no en un párrafo denso.
- Cuando compares cifras (carreras, periodos, estados), señala explícitamente cuál es mayor/menor y por cuánto, y si la tendencia sube o baja entre periodos.
- Si detectas algo que amerite atención (ej: muchas fichas pendientes hace días, muchas alertas en una carrera), menciónalo aunque no te lo hayan preguntado directamente.
- Cierra respuestas de análisis con una breve conclusión o recomendación práctica de 1-2 líneas.
- Indica que los datos provienen de los registros actuales del sistema cuando uses resultados de tools.
- Nunca respondas "no tengo información sobre AzuayCare": tú ERES el asistente de AzuayCare; si falta un dato puntual, dilo específicamente ("no encontré esa ficha con ese criterio"), pero no niegues conocer el sistema.`,
      },
      { role: 'user', content: prompt },
    ];

    try {
      for (let i = 0; i < this.MAX_TOOL_ROUNDS; i++) {
        const payload = {
          model: this.model,
          messages,
          tools: this.tools,
          tool_choice: 'auto',
          temperature: 0.2,
        };

        const response = await firstValueFrom(this.httpService.post(this.url, payload, { headers }));

        const choice = response.data.choices[0];
        const msg = choice.message;

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          return {
            response: msg.content || 'No pude generar una respuesta.',
            fuentes,
          };
        }

        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        });

        for (const tc of msg.tool_calls) {
          const name = tc.function.name;
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {
            args = {};
          }

          this.logger.log(`Tool: ${name} | args: ${JSON.stringify(args)}`);
          const result = await this.ejecutarTool(name, args);

          const filas = Array.isArray(result) ? result.length : result && typeof result === 'object' ? 1 : 0;

          fuentes.push({
            tool: name,
            args,
            filas,
            consultado_en: new Date().toISOString(),
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }

      return {
        response: 'Se alcanzó el límite de consultas internas. Reformula la pregunta de forma más específica.',
        fuentes,
      };
    } catch (error: any) {
      this.logger.error('Error Groq:', error?.response?.data || error);
      throw new InternalServerErrorException('Fallo al procesar la solicitud con la IA');
    }
  }
}