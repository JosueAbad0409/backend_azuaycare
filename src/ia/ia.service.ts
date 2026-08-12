import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import { firstValueFrom } from 'rxjs';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  name?: string;
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
  private readonly model = 'openai/gpt-oss-120b';

  // Más rondas para preguntas complejas que combinan tools
  private readonly MAX_TOOL_ROUNDS = 8;
  // Límite de caracteres para evitar que la BD desborde la memoria de la IA
  private readonly MAX_JSON_RESPONSE_LENGTH = 8000;
  // Límite duro de filas para la tool SQL genérica
  private readonly MAX_SQL_ROWS = 80;

  // Tablas permitidas en la tool SQL genérica (whitelist estricta)
  private readonly ALLOWED_TABLES = new Set([
    'usuarios',
    'fichas_respondidas',
    'carreras',
    'periodos_matricula',
    'formularios',
    'preguntas',
    'respuestas',
    'respuestas_opciones_seleccionadas',
    'opciones_pregunta',
  ]);

  // Palabras prohibidas (cualquier aparición → rechazo)
  private readonly FORBIDDEN_SQL = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', 'execute', 'call', 'copy', 'vacuum', 'analyze',
    'pg_', 'information_schema', 'pg_catalog', 'set ', 'reset ',
    'into ', 'outfile', 'load_file', 'sleep(', 'benchmark(',
    ';', '--', '/*', '*/', 'xp_', 'sp_',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
  ) {}

  // ===================== TOOLS =====================

  private readonly tools = [
    // ---- Tools de alto nivel (rápidas y confiables) ----
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
        description: 'Busca estudiante por cédula, nombre, apellido o email y su ficha. Úsalo SIEMPRE PRIMERO cuando el usuario pregunte por un estudiante específico.',
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
        description: 'Detalle de alertas de una ficha por cédula o ficha_id. Úsalo DESPUÉS de buscar_estudiante o si ya tienes la cédula.',
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
            estado: { type: 'string', description: 'Filtrar por estado (ENVIADA, VALIDADO, RECHAZADA) o TODOS' },
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
    {
      type: 'function',
      function: {
        name: 'evolucion_fichas_por_dia',
        description: 'Serie temporal: cuántas fichas se crearon/enviaron por día en un rango de fechas. Útil para ver tendencias.',
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
        description: 'Compara totales de fichas (enviadas, validadas, con alertas) entre todos los periodos de matrícula registrados.',
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
        description: 'Fichas en estado ENVIADA que llevan más tiempo esperando validación (para priorizar revisión manual).',
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
        description: 'Fichas con los ingresos o egresos más altos/bajos, útil para detectar casos económicos extremos.',
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
        description: 'Cruce de vulnerabilidad por carrera Y por periodo de matrícula en una sola consulta. Usar SIEMPRE que la pregunta combine "carrera" con "periodo(s) anterior(es)", etc.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },

    // ---- Tools nuevas de alto nivel ----
    {
      type: 'function',
      function: {
        name: 'estudiantes_sin_ficha',
        description: 'Estudiantes activos que NO tienen ninguna ficha respondida (o solo tienen borrador). Úsalo para "quiénes no han llenado el formulario", "estudiantes sin ficha", etc.',
        parameters: {
          type: 'object',
          properties: {
            solo_conteo: { type: 'boolean', description: 'Solo el número total' },
            limite: { type: 'number', description: 'Máx. filas a listar (default 30, máx 100)' },
            carrera: { type: 'string', description: 'Filtrar por nombre (o parte) de carrera' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'estudiantes_prioridad_atencion',
        description: 'Lista priorizada de estudiantes que necesitan atención prioritaria. Combina: alertas de vulnerabilidad + fichas ENVIADA antiguas + balances económicos muy negativos. Úsalo para "quién necesita prioridad", "casos urgentes", "atención prioritaria".',
        parameters: {
          type: 'object',
          properties: {
            limite: { type: 'number', description: 'Default 25, máx 50' },
            carrera: { type: 'string' },
            solo_con_alertas: { type: 'boolean', description: 'Solo los que tienen alertas de vulnerabilidad' },
          },
          required: [],
        },
      },
    },

    // ---- Tool SQL genérica (solo lectura, con validaciones) ----
    {
      type: 'function',
      function: {
        name: 'consultar_sql',
        description: `Ejecuta una consulta SQL de SOLO LECTURA (SELECT o WITH ... SELECT) contra la base de datos.
Úsala SOLO cuando ninguna de las otras tools pueda responder la pregunta.
Reglas obligatorias:
- Solo SELECT / WITH ... SELECT
- Debe incluir LIMIT (máximo ${this.MAX_SQL_ROWS})
- Solo tablas permitidas: usuarios, fichas_respondidas, carreras, periodos_matricula, formularios, preguntas, respuestas, respuestas_opciones_seleccionadas, opciones_pregunta
- Usa siempre fecha_desactivacion IS NULL para registros activos
- No uses columnas sensibles (contraseñas, tokens, etc.)
Ejemplo válido: SELECT u.cedula, u.primer_nombre, c.nombre AS carrera FROM usuarios u LEFT JOIN carreras c ON c.id = u.carrera_id WHERE u.fecha_desactivacion IS NULL LIMIT 20`,
        parameters: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'Consulta SQL completa (solo SELECT). Debe incluir LIMIT.',
            },
            explicacion: {
              type: 'string',
              description: 'Breve explicación de por qué esta consulta responde la pregunta del usuario.',
            },
          },
          required: ['sql'],
        },
      },
    },
  ];

  // ===================== EJECUTORES =====================

  private async ejecutarToolSeguro(name: string, args: any): Promise<any> {
    try {
      this.logger.log(`Tool ejecutada: ${name} | args: ${JSON.stringify(args)}`);

      switch (name) {
        case 'resumen_general': return await this.toolResumenGeneral();
        case 'fichas_por_estado': return await this.toolFichasPorEstado();
        case 'fichas_por_carrera': return await this.toolFichasPorCarrera();
        case 'fichas_con_alertas': return await this.toolFichasConAlertas(args);
        case 'alertas_por_pregunta': return await this.toolAlertasPorPregunta();
        case 'buscar_estudiante': return await this.toolBuscarEstudiante(args.termino);
        case 'detalle_alertas_ficha': return await this.toolDetalleAlertas(args);
        case 'listar_fichas_recientes': return await this.toolListarFichasRecientes(args);
        case 'resumen_economico': return await this.toolResumenEconomico();
        case 'listar_periodos': return await this.toolListarPeriodos();
        case 'listar_formularios': return await this.toolListarFormularios();
        case 'listar_carreras': return await this.toolListarCarreras();
        case 'evolucion_fichas_por_dia': return await this.toolEvolucionFichasPorDia(args);
        case 'comparar_periodos': return await this.toolCompararPeriodos();
        case 'alertas_por_carrera': return await this.toolAlertasPorCarrera();
        case 'fichas_pendientes_revision': return await this.toolFichasPendientesRevision(args);
        case 'top_egresos_ingresos': return await this.toolTopEgresosIngresos(args);
        case 'alertas_por_carrera_y_periodo': return await this.toolAlertasPorCarreraYPeriodo();
        case 'estudiantes_sin_ficha': return await this.toolEstudiantesSinFicha(args);
        case 'estudiantes_prioridad_atencion': return await this.toolEstudiantesPrioridadAtencion(args);
        case 'consultar_sql': return await this.toolConsultarSql(args);
        default: return { error: `Tool desconocida: ${name}` };
      }
    } catch (error: any) {
      this.logger.error(`Error en DB al ejecutar tool ${name}:`, error.message);
      return { error: `Hubo un error en la base de datos al buscar esta información: ${error.message}` };
    }
  }

  // ===================== SQL GENÉRICA SEGURA =====================

  private validarSqlSeguro(sql: string): { ok: boolean; error?: string; sqlLimpio?: string } {
    if (!sql || typeof sql !== 'string') {
      return { ok: false, error: 'SQL vacío o inválido' };
    }

    let limpio = sql.trim().replace(/\s+/g, ' ');

    // Quitar punto y coma final si existe
    if (limpio.endsWith(';')) {
      limpio = limpio.slice(0, -1).trim();
    }

    const lower = limpio.toLowerCase();

    // Debe empezar con SELECT o WITH
    if (!lower.startsWith('select') && !lower.startsWith('with')) {
      return { ok: false, error: 'Solo se permiten consultas SELECT o WITH ... SELECT' };
    }

    // Prohibir múltiples statements
    if (limpio.includes(';')) {
      return { ok: false, error: 'No se permiten múltiples statements (punto y coma)' };
    }

    // Prohibir palabras peligrosas
    for (const palabra of this.FORBIDDEN_SQL) {
      if (lower.includes(palabra)) {
        return { ok: false, error: `Consulta rechazada: contiene "${palabra.trim()}" que no está permitido` };
      }
    }

    // Debe tener LIMIT
    if (!/\blimit\s+\d+/i.test(limpio)) {
      // Auto-añadir LIMIT si no lo tiene
      limpio = `${limpio} LIMIT ${this.MAX_SQL_ROWS}`;
    } else {
      // Forzar que el LIMIT no exceda el máximo
      limpio = limpio.replace(/\blimit\s+(\d+)/i, (_, n) => {
        const num = Math.min(parseInt(n, 10) || this.MAX_SQL_ROWS, this.MAX_SQL_ROWS);
        return `LIMIT ${num}`;
      });
    }

    // Verificar que solo use tablas de la whitelist
    // Buscamos FROM y JOIN seguidos de identificador
    const tableRegex = /(?:from|join)\s+([a-z_][a-z0-9_]*)/gi;
    let match: RegExpExecArray | null;
    const tablasUsadas = new Set<string>();
    while ((match = tableRegex.exec(limpio)) !== null) {
      tablasUsadas.add(match[1].toLowerCase());
    }

    for (const t of tablasUsadas) {
      if (!this.ALLOWED_TABLES.has(t)) {
        return {
          ok: false,
          error: `Tabla no permitida: "${t}". Solo puedes usar: ${[...this.ALLOWED_TABLES].join(', ')}`,
        };
      }
    }

    if (tablasUsadas.size === 0) {
      return { ok: false, error: 'No se detectó ninguna tabla en la consulta (FROM/JOIN)' };
    }

    return { ok: true, sqlLimpio: limpio };
  }

  private async toolConsultarSql(args: { sql?: string; explicacion?: string }) {
    const validacion = this.validarSqlSeguro(args?.sql || '');
    if (!validacion.ok) {
      this.logger.warn(`SQL rechazado: ${validacion.error} | original: ${args?.sql}`);
      return { error: validacion.error, sql_recibido: args?.sql };
    }

    this.logger.log(`SQL aprobado: ${validacion.sqlLimpio}`);

    try {
      // Timeout de 8 segundos a nivel de statement (Postgres)
      await this.dataSource.query(`SET LOCAL statement_timeout = '8000'`);
      const rows = await this.dataSource.query(validacion.sqlLimpio!);

      // Restaurar (aunque SET LOCAL es por transaction, por si acaso)
      try {
        await this.dataSource.query(`SET LOCAL statement_timeout = '0'`);
      } catch {
        // ignore
      }

      return {
        explicacion: args?.explicacion || null,
        filas: Array.isArray(rows) ? rows.length : 0,
        datos: rows,
      };
    } catch (error: any) {
      this.logger.error(`Error ejecutando SQL genérico: ${error.message}`);
      return {
        error: `Error al ejecutar la consulta: ${error.message}`,
        sql_intentado: validacion.sqlLimpio,
      };
    }
  }

  // ===================== FUNCIONES DE BASE DE DATOS =====================

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
      return { error: 'Debes indicar cedula o ficha_id para ejecutar esta acción.' };
    }

    let whereClause = `
      r.fecha_desactivacion IS NULL
      AND p.fecha_desactivacion IS NULL
      AND p.revision_manual_obligatoria = true
      AND f.fecha_desactivacion IS NULL
      AND UPPER(COALESCE(op.texto_opcion, r.valor_texto, r.valor_numerico::text, '')) NOT IN ('NO', 'NINGUNA', 'N/A', 'NINGUNO', 'FALSO', '')
    `;

    const queryParams: any[] = [];
    if (args.cedula) {
      whereClause += ` AND u.cedula = $1`;
      queryParams.push(args.cedula);
    } else if (args.ficha_id) {
      whereClause += ` AND f.id = $1::uuid`;
      queryParams.push(args.ficha_id);
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
      WHERE ${whereClause}
      ORDER BY p.enunciado
    `,
      queryParams,
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

  private async toolEstudiantesSinFicha(args: { solo_conteo?: boolean; limite?: number; carrera?: string }) {
    const limite = Math.min(Number(args?.limite) || 30, 100);
    const carreraFiltro = args?.carrera ? `%${String(args.carrera).trim().toLowerCase()}%` : null;

    if (args?.solo_conteo) {
      const [row] = await this.dataSource.query(
        `
        SELECT COUNT(*)::int AS total_sin_ficha
        FROM usuarios u
        LEFT JOIN carreras c ON c.id = u.carrera_id
        LEFT JOIN fichas_respondidas f
          ON f.usuario_id = u.id
          AND f.fecha_desactivacion IS NULL
          AND f.estado_ficha != 'BORRADOR'
        WHERE u.fecha_desactivacion IS NULL
          AND f.id IS NULL
          AND ($1::text IS NULL OR LOWER(c.nombre) LIKE $1)
      `,
        [carreraFiltro],
      );
      return row;
    }

    return this.dataSource.query(
      `
      SELECT
        u.cedula,
        u.primer_nombre || ' ' || COALESCE(u.segundo_nombre, '') || ' ' || u.primer_apellido AS nombre,
        c.nombre AS carrera,
        u.email_institucional
      FROM usuarios u
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN fichas_respondidas f
        ON f.usuario_id = u.id
        AND f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
      WHERE u.fecha_desactivacion IS NULL
        AND f.id IS NULL
        AND ($1::text IS NULL OR LOWER(c.nombre) LIKE $1)
      ORDER BY c.nombre NULLS LAST, u.primer_apellido
      LIMIT $2
    `,
      [carreraFiltro, limite],
    );
  }

  private async toolEstudiantesPrioridadAtencion(args: {
    limite?: number;
    carrera?: string;
    solo_con_alertas?: boolean;
  }) {
    const limite = Math.min(Number(args?.limite) || 25, 50);
    const carreraFiltro = args?.carrera ? `%${String(args.carrera).trim().toLowerCase()}%` : null;

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
        u.cedula,
        u.primer_nombre || ' ' || u.primer_apellido AS estudiante,
        c.nombre AS carrera,
        f.estado_ficha,
        COALESCE(a.total_alertas, 0) AS alertas,
        EXTRACT(DAY FROM NOW() - f.created_at)::int AS dias_esperando,
        f.balance_final,
        f.total_ingresos,
        f.total_egresos,
        (
          COALESCE(a.total_alertas, 0) * 10
          + CASE WHEN f.estado_ficha IN ('ENVIADA','ENVIADO')
                 THEN EXTRACT(DAY FROM NOW() - f.created_at)::int ELSE 0 END
          + CASE WHEN f.balance_final < -500 THEN 15
                 WHEN f.balance_final < 0 THEN 5
                 ELSE 0 END
        ) AS score_prioridad
      FROM fichas_respondidas f
      INNER JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN carreras c ON c.id = u.carrera_id
      LEFT JOIN Alertas a ON a.ficha_id = f.id
      WHERE f.fecha_desactivacion IS NULL
        AND f.estado_ficha != 'BORRADOR'
        AND ($1::text IS NULL OR LOWER(c.nombre) LIKE $1)
        AND ($2::boolean IS FALSE OR a.ficha_id IS NOT NULL)
      ORDER BY score_prioridad DESC, dias_esperando DESC
      LIMIT $3
    `,
      [carreraFiltro, !!args?.solo_con_alertas, limite],
    );
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

REGLAS DE ORO (OBLIGATORIAS):
1. NUNCA inventes datos, nombres, cédulas ni cifras. Si no tienes la información de una tool, dilo claramente.
2. Prefiere siempre las tools de alto nivel (estudiantes_sin_ficha, estudiantes_prioridad_atencion, fichas_con_alertas, etc.) antes que consultar_sql.
3. Si preguntan por un estudiante concreto → usa PRIMERO buscar_estudiante. Luego detalle_alertas_ficha si hace falta.
4. Si preguntan "quiénes no han llenado el formulario / no tienen ficha" → usa estudiantes_sin_ficha.
5. Si preguntan "quién necesita prioridad / atención urgente / casos prioritarios" → usa estudiantes_prioridad_atencion.
6. Usa consultar_sql SOLO cuando ninguna otra tool pueda responder la pregunta.
7. Responde siempre en español, claro, con tablas markdown cuando haya listas.
8. Si una tool devuelve error o datos vacíos, dilo amablemente y sugiere cómo reformular.
9. Cuando los resultados estén truncados, avisa al usuario y pide que refine.

ESQUEMA DE LA BASE DE DATOS (solo tablas y columnas relevantes):

- usuarios: id (uuid), cedula, primer_nombre, segundo_nombre, primer_apellido, email_institucional, carrera_id, fecha_desactivacion
- fichas_respondidas: id (uuid), usuario_id, formulario_id, estado_ficha ('BORRADOR'|'ENVIADA'|'ENVIADO'|'VALIDADO'|'RECHAZADA'), total_ingresos, total_egresos, balance_final, created_at, updated_at, fecha_desactivacion
- carreras: id, nombre, fecha_desactivacion
- periodos_matricula: id, nombre, fecha_inicio, fecha_fin, activo (bool), fecha_desactivacion
- formularios: id, titulo, publicado, periodo_id, created_at, fecha_desactivacion
- preguntas: id, enunciado, revision_manual_obligatoria (bool), fecha_desactivacion
- respuestas: id, ficha_id, pregunta_id, valor_texto, valor_numerico, fecha_desactivacion
- respuestas_opciones_seleccionadas: respuesta_id, opcion_id
- opciones_pregunta: id, texto_opcion

Convenciones importantes:
- Un registro activo tiene fecha_desactivacion IS NULL.
- "Ficha enviada" = estado_ficha IN ('ENVIADA','ENVIADO').
- "Con alertas" = tiene al menos una respuesta a pregunta con revision_manual_obligatoria=true cuyo valor NO es 'NO','NINGUNA','N/A','NINGUNO','FALSO' ni vacío.
- Siempre filtra por fecha_desactivacion IS NULL en consultas propias.`,
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
          temperature: 0.1,
        };

        const response = await firstValueFrom(this.httpService.post(this.url, payload, { headers }));
        const choice = response.data.choices[0];
        const msg = choice.message;

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          return {
            response: msg.content || 'Proceso completado sin respuesta generada en texto.',
            fuentes,
          };
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          tool_calls: msg.tool_calls,
        };
        if (msg.content) {
          assistantMessage.content = msg.content;
        }
        messages.push(assistantMessage);

        for (const tc of msg.tool_calls) {
          const name = tc.function.name;
          let args = {};

          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {
            this.logger.warn(`El modelo generó un JSON inválido para la tool ${name}`);
            args = {};
          }

          const result = await this.ejecutarToolSeguro(name, args);
          const filas = Array.isArray(result)
            ? result.length
            : result && typeof result === 'object' && !result.error
              ? (result.filas ?? 1)
              : 0;

          fuentes.push({
            tool: name,
            args,
            filas,
            consultado_en: new Date().toISOString(),
          });

          let resultString = JSON.stringify(result);
          if (resultString.length > this.MAX_JSON_RESPONSE_LENGTH) {
            this.logger.warn(`Respuesta de DB demasiado larga (${resultString.length} char). Truncando.`);
            resultString = JSON.stringify({
              advertencia:
                'Los resultados son demasiado grandes. Se muestran solo los primeros 15. Pídele al usuario que sea más específico.',
              datos: Array.isArray(result)
                ? result.slice(0, 15)
                : result?.datos
                  ? Array.isArray(result.datos)
                    ? result.datos.slice(0, 15)
                    : result.datos
                  : result,
            });
          }

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name,
            content: resultString,
          });
        }
      }

      return {
        response:
          'Se alcanzó el límite de búsquedas internas. Por favor, reformula tu pregunta para hacerla más específica o simple.',
        fuentes,
      };
    } catch (error: any) {
      this.logger.error('Error procesando respuesta con IA:', error?.response?.data || error);
      throw new InternalServerErrorException('Fallo al conectar con el servicio de IA de AzuayCare.');
    }
  }
}
