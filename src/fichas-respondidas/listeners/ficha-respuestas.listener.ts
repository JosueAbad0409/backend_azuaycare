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

      // 1. Extraer Ingresos (Manejando textos y números, e ignorando borradores)
      const ingresosDb = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
        .select('r.valor_numerico', 'num')
        .addSelect('r.valor_texto', 'txt')
        .innerJoin('r.pregunta', 'p')
        .where('r.ficha_id = :fichaId', { fichaId: payload.fichaId })
        .andWhere("p.categoria_financiera = 'INGRESO'")
        .andWhere('r.fecha_desactivacion IS NULL') // 🔥 FIX: Fundamental para no sumar historiales
        .getRawMany();
        
      let totalIngresos = 0;
      // Convertimos a número de forma segura, ya sea que Angular lo envió como int o como string
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

      const balance = totalIngresos - totalEgresos;

      // 3. Buscar en el motor de variables calculadas para 'BALANCE'
      let rangoAsignadoId = null;
      const rango = await this.dataSource.manager.createQueryBuilder('rangos_variable_calculada', 'rvc')
        .where('rvc.formulario_id = :formId', { formId: ficha.formulario_id })
        .andWhere("rvc.variable_calculo = 'BALANCE'")
        .andWhere(':balance >= rvc.valor_min', { balance })
        // 🔥 FIX: Soporte para rangos infinitos (valor_max vacío)
        .andWhere('(:balance <= rvc.valor_max OR rvc.valor_max IS NULL)', { balance })
        .andWhere('rvc.fecha_desactivacion IS NULL')
        .getRawOne();

      if (rango) {
        rangoAsignadoId = rango.id;
      }

      // 4. Guardado atómico
      // Nota: el cálculo de vulnerabilidad basado en puntaje_riesgo fue
      // retirado del sistema. rango_vulnerabilidad_id y puntaje_vulnerabilidad
      // ya no se recalculan aquí.
      await this.dataSource.manager.update(FichaRespondida, payload.fichaId, {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance_final: balance,
        rango_resultado_id: rangoAsignadoId,
      });

      this.logger.log(`[Variable Calculada] Ficha ${payload.fichaId} | Balance: ${balance}`);

      // 6. Notificación
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