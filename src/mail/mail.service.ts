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
      port: 2525,
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
      subject: 'Confirmación de Recepción - AzuayCare',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <h2 style="color: #0f172a;">Hola ${nombreDestino},</h2>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; color: #065f46; font-size: 15px;">
              <strong>Registro Exitoso:</strong> Tu formulario ha sido recibido y registrado correctamente en el sistema.
            </p>
          </div>

          <p style="font-size: 16px;">Nuestro equipo revisará la información enviada y te notificará cualquier novedad o resolución a través de este medio.</p>
          
          <br>
          <p>Saludos cordiales,</p>
          <p><strong>Departamento de Bienestar Estudiantil - ISTA</strong><br>Plataforma AzuayCare</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Correo Exitoso] Confirmación de recepción enviada a ${correoDestino} (ID: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error('[Error de Correo] No se pudo enviar confirmación vía Brevo:', error);
      throw error;
    }
  }

  // Agrega esto debajo de tu método existente en MailService
  async enviarNotificacionEstadoFicha(
    correoDestino: string, 
    nombreDestino: string, 
    estado: string, 
    comentarioRaw: string
  ) {
    const estadoFormateado = estado.toUpperCase();
    
    // 1. Asuntos y mensajes principales más generales (sin decir "Socioeconómica")
    let asunto = 'Actualización de tu Trámite / Ficha - AzuayCare';
    let mensajePrincipal = '';

    if (estadoFormateado === 'BORRADOR') {
        asunto = '⚠️ Acción Requerida: Corrección de Documento';
        mensajePrincipal = 'Tu formulario ha sido habilitado nuevamente para edición. Requerimos que realices algunas actualizaciones.';
    } else if (estadoFormateado === 'VALIDADO') {
        asunto = '✅ Ficha Aprobada Exitosamente';
        mensajePrincipal = 'Tu registro ha sido revisado y validado exitosamente por nuestra institución.';
    } else if (estadoFormateado === 'RECHAZADO' || estadoFormateado === 'RECHAZADA') {
        asunto = '❌ Ficha Rechazada';
        mensajePrincipal = 'Tu registro ha sido revisado y lamentablemente no ha sido aprobado en esta ocasión.';
    }

    // 2. Lógica inteligente para el comentario:
    // Si el coordinador escribió algo, lo usamos. Si lo dejó en blanco, ponemos uno por defecto.
    let comentarioFinal = comentarioRaw ? comentarioRaw.trim() : '';

    if (!comentarioFinal) {
      if (estadoFormateado === 'VALIDADO') {
        comentarioFinal = 'La información presentada cumple con los requisitos establecidos y ha sido procesada de manera correcta. No se requiere ninguna acción adicional de tu parte.';
      } else if (estadoFormateado === 'BORRADOR') {
        comentarioFinal = 'Por favor, ingresa al sistema, verifica la información registrada y vuelve a enviar el formulario asegurándote de que todos los datos sean correctos.';
      } else {
        comentarioFinal = 'El trámite no cumple con los requisitos o políticas actuales vigentes.';
      }
    }

    // 3. Renderizamos el bloque (como ahora siempre hay texto, siempre se mostrará bonito)
    const bloqueComentario = `
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
        <h4 style="margin-top: 0; color: #1e293b; font-size: 14px; text-transform: uppercase;">Resolución / Observación:</h4>
        <p style="margin-bottom: 0; color: #334155; font-size: 15px;"><em>"${comentarioFinal}"</em></p>
      </div>`;

    const mailOptions = {
      from: `"${this.configService.get<string>('BREVO_SENDER_NAME')}" <${this.configService.get<string>('BREVO_SENDER_EMAIL')}>`,
      to: correoDestino,
      subject: asunto,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <h2 style="color: #0f172a;">Hola ${nombreDestino},</h2>
          <p style="font-size: 16px;">${mensajePrincipal}</p>
          
          ${bloqueComentario}
          
          <br>
          <p>Saludos cordiales,</p>
          <p><strong>Departamento de Bienestar Estudiantil - ISTA</strong><br>Plataforma AzuayCare</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[Correo Exitoso] Notificación de estado enviada a ${correoDestino} (ID: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error('[Error de Correo] No se pudo enviar notificación vía Brevo:', error);
      return false; 
    }
  }

}