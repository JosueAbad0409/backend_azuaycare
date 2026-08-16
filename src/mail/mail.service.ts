import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Configuramos Nodemailer para usar el SMTP de Brevo
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false, // Usamos false para el puerto 587
      auth: {
        user: this.configService.get<string>('BREVO_SMTP_LOGIN'),
        pass: this.configService.get<string>('BREVO_SMTP_KEY'),
      },
    });
  }

  

  async enviarConfirmacionFicha(correoDestino: string, nombreDestino: string) {
    const mailOptions = {
      from: `"${this.configService.get<string>('BREVO_SENDER_NAME')}" <${this.configService.get<string>('BREVO_SENDER_EMAIL')}>`,
      to: correoDestino,
      subject: 'Ficha Socioeconómica Recibida - AzuayCare',
      html: `
        <html>
          <body>
            <h2>Hola ${nombreDestino},</h2>
            <p>El cálculo de tu ficha socioeconómica se ha realizado correctamente.</p>
            <p>Nuestro equipo revisará la información y te notificará cualquier novedad.</p>
            <br>
            <p>Saludos,</p>
            <p><strong>Equipo AzuayCare</strong></p>
          </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Correo Exitoso] Mensaje enviado a ${correoDestino} (ID: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error('[Error de Correo] No se pudo enviar vía Brevo:', error);
      throw error;
    }
  }

  // Agrega esto debajo de tu método existente en MailService
  async enviarNotificacionEstadoFicha(
    correoDestino: string, 
    nombreDestino: string, 
    estado: string, 
    comentario: string
  ) {
    const estadoFormateado = estado.toUpperCase();
    let asunto = 'Actualización de tu Ficha Socioeconómica - AzuayCare';
    let mensajePrincipal = '';

    if (estadoFormateado === 'BORRADOR') {
        asunto = '⚠️ Acción Requerida: Corrección de Ficha';
        mensajePrincipal = 'Tu ficha ha sido habilitada nuevamente para edición. Requerimos que realices algunas correcciones.';
    } else if (estadoFormateado === 'VALIDADO') {
        asunto = '✅ Ficha Socioeconómica Aprobada';
        mensajePrincipal = 'Tu ficha ha sido validada exitosamente por Bienestar Estudiantil.';
    } else if (estadoFormateado === 'RECHAZADO' || estadoFormateado === 'RECHAZADA') {
        asunto = '❌ Ficha Socioeconómica Rechazada';
        mensajePrincipal = 'Tu ficha ha sido revisada y no ha sido aprobada.';
    }

    const bloqueComentario = comentario 
      ? `<div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
           <h4>Mensaje del Revisor:</h4><p><em>"${comentario}"</em></p>
         </div>` : '';

    const mailOptions = {
      from: `"${this.configService.get<string>('BREVO_SENDER_NAME')}" <${this.configService.get<string>('BREVO_SENDER_EMAIL')}>`,
      to: correoDestino,
      subject: asunto,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Hola ${nombreDestino},</h2>
          <p>${mensajePrincipal}</p>
          ${bloqueComentario}
          <p>Saludos cordiales,<br><strong>Equipo AzuayCare - ISTA</strong></p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('[Error Brevo]:', error);
      return false; 
    }
  }
  
}