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

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly url = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
  ) { }

  // ===================== TOOLS (lo que la IA puede pedir) =====================

  private readonly tools = [
    {
      type: 'function',
      function: {
        name: 'resumen_general',
        description:
          'Obtiene totales generales del sistema: total de fichas, carreras, formularios y periodo activo.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_por_estado',
        description: 'Cuenta fichas agrupadas por estado (ENVIADA, VALIDADO, RECHAZADA, etc.).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fichas_con_alertas',
        description:
          'Lista o cuenta fichas con alertas de vulnerabilidad (respuestas afirmativas a preguntas con revision_manual_obligatoria). Útil para prioridad de atención.',
        parameters: {
          type: 'object',
          properties: {
            solo_conteo: {
              type: 'boolean',
              description: 'Si true, solo devuelve el número. Si false, lista estudiantes.',
            },
            limite: {
              type: 'number',
              description: 'Máximo de fichas a listar (default 20)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buscar_estudiante',
        description: 'Busca un estudiante por cédula, nombre o apellido y muestra estado de su ficha.',
        parameters: {
          type: 'object',
          properties: {
            termino: {
              type: 'string',
              description: 'Cédula, nombre o apellido a buscar',
            },
          },
          required: ['termino'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'detalle_alertas_ficha',
        description:
          'Detalle de las respuestas que generan alerta en una ficha concreta (por cédula o ficha_id).',
        parameters: {
          type: 'object',
          properties: {
            cedula: { type: 'string', description: 'Cédula del estudiante' },
            ficha_id: { type: 'string', description: 'UUID de la ficha' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'alertas_por_pregunta',
        description:
          'Cuenta cuántas respuestas afirmativas hay por cada pregunta de revisión manual (embarazo, discapacidad, etc.).',
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
      case 'fichas_con_alertas':
        return this.toolFichasConAlertas(args);
      case 'buscar_estudiante':
        return this.toolBuscarEstudiante(args.termino);
      case 'detalle_alertas_ficha':
        return this.toolDetalleAlertas(args);
      case 'alertas_por_pregunta':
        return this.toolAlertasPorPregunta();
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

  private async toolFichasConAlertas(args: { solo_conteo?: boolean; limite?: number }) {
    const limite = Math.min(Number(args?.limite) || 20, 50);

    if (args?.solo_conteo) {
      const [row] = await this.dataSource.query(`
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
        WHERE f.fecha_desactivacion IS NULL
          AND f.estado_ficha != 'BORRADOR'
      `);
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
      ORDER BY a.total_alertas DESC
      LIMIT $1
    `,
      [limite],
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

  // ===================== ORQUESTACIÓN CON GROQ =====================

  async procesarMensaje(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GROQ_API_KEY no configurada');
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const messages: ChatMessage[] = [

      {
        role: 'system',
        content: `Eres el asistente de Bienestar Estudiantil de AzuayCare (Instituto Superior Tecnológico del Azuay).

OBLIGATORIO:
- Para CUALQUIER pregunta sobre números, fichas, alertas, estudiantes, estados, reportes o estadísticas, DEBES usar las herramientas (tools).
- NUNCA inventes servicios médicos, telemedicina, clínicas ni datos.
- Si una tool devuelve vacío o 0, dilo con claridad.
- Responde solo con información obtenida de las tools o con orientación de uso del sistema.
- Español, breve y profesional.
- No muestres UUIDs salvo que te los pidan.

Herramientas disponibles:
- resumen_general
- fichas_por_estado
- fichas_con_alertas
- buscar_estudiante
- detalle_alertas_ficha
- alertas_por_pregunta`,
      },
      { role: 'user', content: prompt },
    ];

    try {
      // Hasta 3 rondas de tools (evita loops infinitos)
      for (let i = 0; i < 3; i++) {
        const payload = {
          model: this.model,
          messages,
          tools: this.tools,
          tool_choice: 'auto',
          temperature: 0.2,
        };

        const response = await firstValueFrom(
          this.httpService.post(this.url, payload, { headers }),
        );

        const choice = response.data.choices[0];
        const msg = choice.message;

        // Si no hay tool calls → respuesta final
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          return msg.content || 'No pude generar una respuesta.';
        }

        // Guardar el mensaje del assistant con tool_calls
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        });

        // Ejecutar cada tool y devolver resultado
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

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }

      return 'Se alcanzó el límite de consultas internas. Reformula la pregunta de forma más específica.';
    } catch (error: any) {
      this.logger.error('Error Groq:', error?.response?.data || error);
      throw new InternalServerErrorException('Fallo al procesar la solicitud con la IA');
    }
  }
}