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
        select: { id: true, formulario_id: true }
      });

      if (!ficha) return;

      // 1. Extraer Ingresos
      const ingresosDb = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
        .select('r.valor_numerico', 'num')
        .addSelect('r.valor_texto', 'txt')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere("p.categoria_financiera = 'INGRESO'")
        .andWhere('r.fecha_desactivacion IS NULL')
        .getRawMany();
        
      let totalIngresos = 0;
      ingresosDb.forEach(r => totalIngresos += Number(r.num) || Number(r.txt) || 0);

      // 2. Extraer Egresos
      const egresosDb = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
        .select('r.valor_numerico', 'num')
        .addSelect('r.valor_texto', 'txt')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere("p.categoria_financiera = 'EGRESO'")
        .andWhere('r.fecha_desactivacion IS NULL')
        .getRawMany();

      let totalEgresos = 0;
      egresosDb.forEach(r => totalEgresos += Number(r.num) || Number(r.txt) || 0);

      const balanceCrudo = totalIngresos - totalEgresos;
      const balance = Math.max(0, balanceCrudo);

      // 3. Buscar en el motor de variables calculadas para 'BALANCE'
      let rangoAsignadoId = null;
      let esVulnerablePorBalance = false;

      const rango = await this.dataSource.manager.createQueryBuilder('rangos_variable_calculada', 'rvc')
        .select(['rvc.id AS id', 'rvc.es_vulnerable AS es_vulnerable'])
        .where('rvc.formulario_id = :formId', { formId: ficha.formulario_id })
        .andWhere("rvc.variable_calculo = 'BALANCE'")
        .andWhere(':balance >= rvc.valor_min', { balance })
        .andWhere('(:balance <= rvc.valor_max OR rvc.valor_max IS NULL)', { balance })
        .andWhere('rvc.fecha_desactivacion IS NULL')
        .getRawOne();

      if (rango) {
        rangoAsignadoId = rango.id;
        esVulnerablePorBalance = Boolean(rango.es_vulnerable);
      }

      // 4. Guardado atómico
      await this.dataSource.manager.update(FichaRespondida, payload.fichaId, {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance_final: balance,
        rango_resultado_id: rangoAsignadoId,
      });

      this.logger.log(`[Variable Calculada] Ficha ${payload.fichaId} | Balance: ${balance} | Vulnerable Rango: ${esVulnerablePorBalance}`);

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