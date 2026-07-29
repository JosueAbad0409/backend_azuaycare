import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { MailService } from 'src/mail/mail.service'; 
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';
import { FichaRespondida } from '../entities/ficha-respondida.entity';

@Injectable()
export class FichaRespuestasListener {
  private readonly logger = new Logger(FichaRespuestasListener.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService, 
  ) { }

  @OnEvent('ficha.respuestas.actualizadas', { async: true })
  async handleFichaRespuestasActualizadas(payload: { fichaId: string }) {
    try {
      const ficha = await this.dataSource.manager.findOne(FichaRespondida, { 
        where: { id: payload.fichaId },
        select: {id: true, 
          formulario_id: true}
      });

      if (!ficha) return;

      // 1. Sumatoria de Ingresos (Filtrando por categoria_financiera)
      const valIngresos = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
        .select('SUM(r.valor_numerico)', 'total')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere("p.categoria_financiera = 'INGRESO'")
        .getRawOne();
        
      // 2. Sumatoria de Egresos
      const valEgresos = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
        .select('SUM(r.valor_numerico)', 'total')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere("p.categoria_financiera = 'EGRESO'")
        .getRawOne();

      const totalIngresos = valIngresos?.total ? parseFloat(valIngresos.total) : 0;
      const totalEgresos = valEgresos?.total ? parseFloat(valEgresos.total) : 0;
      const balance = totalIngresos - totalEgresos;

      // 3. Buscar en el nuevo motor de variables calculadas para la variable 'BALANCE'
      let rangoAsignadoId = null;
      const rango = await this.dataSource.manager.createQueryBuilder('rangos_variable_calculada', 'rvc')
        .where('rvc.formulario_id = :formId', { formId: ficha.formulario_id })
        .andWhere("rvc.variable_calculo = 'BALANCE'")
        .andWhere(':balance >= rvc.valor_min', { balance })
        .andWhere(':balance <= rvc.valor_max', { balance })
        .andWhere('rvc.fecha_desactivacion IS NULL')
        .getRawOne();

      if (rango) {
        rangoAsignadoId = rango.id;
      }

      // 4. Guardado atómico
      await this.dataSource.manager.update(FichaRespondida, payload.fichaId, {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance_final: balance,
        rango_resultado_id: rangoAsignadoId // Si no encuentra, queda en null, sin lanzar error
      });

      this.logger.log(`[Variable Calculada] Ficha ${payload.fichaId} | Balance: ${balance} | Rango Asignado ID: ${rangoAsignadoId || 'Ninguno'}`);

      // 5. Notificación
      const datosUsuario = await this.dataSource.manager.createQueryBuilder('fichas_respondidas', 'f')
        .select(['u.primer_nombre AS nombres', 'u.email_institucional AS correo'])
        .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
        .where('f.id = :fichaId', { fichaId: payload.fichaId })
        .getRawOne();

      if (datosUsuario && datosUsuario.correo) {
        await this.mailService.enviarConfirmacionFicha(datosUsuario.correo, datosUsuario.nombres || 'Estudiante');
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`[Event Error] No se pudo clasificar la ficha ${payload.fichaId}:`, msg);
    }
  }
}