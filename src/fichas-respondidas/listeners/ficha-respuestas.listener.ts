import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { FichasRespondidasService } from '../fichas-respondidas.service';
import { MailService } from 'src/mail/mail.service'; 
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';

@Injectable()
export class FichaRespuestasListener {
  private readonly logger = new Logger(FichaRespuestasListener.name);

  constructor(
    private readonly fichasService: FichasRespondidasService,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService, 
  ) { }

  @OnEvent('ficha.respuestas.actualizadas', { async: true })
  async handleFichaRespuestasActualizadas(payload: { fichaId: string }) {
    try {
      // 1. Sumatoria de Ingresos (Filtrando por categoria_financiera)
      const resultadoIngresos = await this.dataSource.manager
        .createQueryBuilder(RespuestasFormulario, 'r')
        .select('SUM(r.valor_numerico)', 'total')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere('p.categoria_financiera = :categoria', { categoria: 'INGRESO' })
        .getRawOne();

      // 2. Sumatoria de Egresos
      const resultadoEgresos = await this.dataSource.manager
        .createQueryBuilder(RespuestasFormulario, 'r')
        .select('SUM(r.valor_numerico)', 'total')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere('p.categoria_financiera = :categoria', { categoria: 'EGRESO' })
        .getRawOne();

      const totalIngresos = resultadoIngresos?.total ? parseFloat(resultadoIngresos.total) : 0;
      const totalEgresos = resultadoEgresos?.total ? parseFloat(resultadoEgresos.total) : 0;

      // 3. Recalculamos el nivel socioeconómico y guardamos el balance
      await this.fichasService.recalcularNivelSocioeconomico(payload.fichaId, totalIngresos, totalEgresos);

      this.logger.log(`[Event Success] Ficha ${payload.fichaId} calculada. Ingresos: $${totalIngresos}, Egresos: $${totalEgresos}`);

      // 4. Búsqueda de usuario para notificación
      const datosUsuario = await this.dataSource.manager
        .createQueryBuilder('fichas_respondidas', 'f')
        .select(['u.primer_nombre AS nombres', 'u.email_institucional AS correo'])
        .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
        .where('f.id = :fichaId', { fichaId: payload.fichaId })
        .getRawOne();

      // 5. Disparamos el correo (si aplica)
      if (datosUsuario && datosUsuario.correo) {
        await this.mailService.enviarConfirmacionFicha(
          datosUsuario.correo,
          datosUsuario.nombres || 'Estudiante'
        );
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[Event Error] No se pudo recalcular/notificar la ficha ${payload.fichaId}:`, msg);
    }
  }
}