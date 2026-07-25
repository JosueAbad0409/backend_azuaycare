import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportesService {
  constructor(private readonly dataSource: DataSource) {}

  // 🔥 SOLUCIÓN AUDITORÍA: El backend ya no arma el Excel. 
  // Ahora devuelve un JSON dinámico pivotado con jsonb_object_agg.
  async obtenerDatosReporteDinamico(periodoId: string) {
    const periodo = await this.dataSource.manager.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [periodoId],
    );

    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe o está inactivo.');
    }

    // Consulta nativa para hacer el pivot de filas a columnas (Preguntas -> Respuestas)
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
        
        -- 🔥 Pivot dinámico de PostgreSQL: convierte las múltiples filas de respuestas en un solo objeto JSON
        (
          SELECT jsonb_object_agg(
            p.enunciado, -- Asumiendo que 'enunciado' es la columna en tu tabla de preguntas
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
      datos: resultados, // Este array se enviará al Frontend para generar el Excel/PDF
    };
  }
}