import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { FichasRespondidasService } from '../fichas-respondidas.service';

@Injectable()
export class FichaRespuestasListener {
  constructor(
    private readonly fichasService: FichasRespondidasService,
    private readonly dataSource: DataSource,
  ) {}

  @OnEvent('ficha.respuestas.actualizadas', { async: true }) 
  async handleFichaRespuestasActualizadas(payload: { fichaId: string }) {
    try {
            const resultadoIngresos = await this.dataSource.manager
        .createQueryBuilder()
        .select('SUM(r.valor_numerico)', 'total')
        .from('respuestas', 'r')
        .innerJoin('preguntas', 'p', 'p.id = r.pregunta_id')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere('p.categoria_financiera = :categoria', { categoria: 'INGRESO' })
        .andWhere('r.fecha_desactivacion IS NULL')
        .getRawOne();

           const resultadoEgresos = await this.dataSource.manager
        .createQueryBuilder()
        .select('SUM(r.valor_numerico)', 'total')
        .from('respuestas', 'r')
        .innerJoin('preguntas', 'p', 'p.id = r.pregunta_id')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere('p.categoria_financiera = :categoria', { categoria: 'EGRESO' })
        .andWhere('r.fecha_desactivacion IS NULL')
        .getRawOne();

      const totalIngresos = resultadoIngresos?.total ? parseFloat(resultadoIngresos.total) : 0;
      const totalEgresos = resultadoEgresos?.total ? parseFloat(resultadoEgresos.total) : 0;

            await this.fichasService.recalcularNivelSocioeconomico(payload.fichaId, totalIngresos, totalEgresos);
      
      console.log(`[Event Success] Ficha ${payload.fichaId} calculada asíncronamente. Ingresos: $${totalIngresos}, Egresos: $${totalEgresos}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`[Event Error] No se pudo recalcular la ficha ${payload.fichaId}:`, msg);
    }
  }
}