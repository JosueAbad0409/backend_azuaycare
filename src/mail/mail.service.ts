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
}