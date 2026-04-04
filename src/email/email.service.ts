import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { envs } from '@/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: 1025,
      secure: false,
      ignoreTLS: true,
    });
  }
  async sendVerificationEmail(
    email: string,
    code: string,
    fullName: string,
    userId: string,
  ) {
    try {
      const verificationLink = `${envs.frontendUrl}/verify-account?code=${code}`;
      const emailTemplate = await this.getEmailTemplate(
        code,
        fullName,
        verificationLink,
      );

      const info = await this.transporter.sendMail({
        from: `"Balancio" <noreply@balancio.com>`,
        to: email,
        subject: `Verificación de cuenta - Balancio`,
        html: emailTemplate,
      });

      this.logger.log(
        `Email de verificación enviado a ${email} - ID: ${info.messageId}`,
      );
      return { success: true, emailId: info.messageId };
    } catch (error) {
      this.logger.error(`Error al enviar email a ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
    fullName: string,
  ) {
    try {
      const emailTemplate = await this.getPasswordResetTemplate(
        resetLink,
        fullName,
      );

      const info = await this.transporter.sendMail({
        from: `"Balancio" <noreply@Balancio.com>`,
        to: email,
        subject: `Recuperación de contraseña - Balancio`,
        html: emailTemplate,
      });

      this.logger.log(
        `Email de recuperación de contraseña enviado a ${email} - ID: ${info.messageId}`,
      );
      return { success: true, emailId: info.messageId };
    } catch (error) {
      this.logger.error(
        `Error al enviar email de recuperación a ${email}:`,
        error,
      );
      throw error;
    }
  }
  private async getEmailTemplate(
    code: string,
    fullName: string,
    verificationLink: string,
  ): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verificación de cuenta - Balancio</title>
</head>

<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #1e3a5f; letter-spacing: -0.5px;">
                💰 Balancio
              </h1>
            </td>
          </tr>

          <!-- Card Container -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">

              <!-- Title -->
              <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1e3a5f; text-align: center;">
                ¡Bienvenido, ${fullName}!
              </h2>

              <!-- Subtitle -->
              <p style="margin: 0 0 32px 0; font-size: 15px; color: #6b7280; text-align: center; line-height: 1.5;">
                Gracias por registrarte. Empezá a gestionar tu negocio de forma simple y profesional.
              </p>

              <!-- OTP Code Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 24px 48px;">
                      <span style="font-size: 40px; font-weight: 700; color: #ffffff; letter-spacing: 14px; font-family: 'Courier New', monospace;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

<!-- Helper Text -->
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280; text-align: center;">
                O hacé clic en el botón para activar automáticamente:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-size: 16px; font-weight: 600;">
                      Activar cuenta
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #9ca3af; text-align: center;">
                      Este código es válido durante 24 horas.
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center; line-height: 1.5;">
                      Si no realizaste esta acción, podés ignorar este correo de forma segura.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 Balancio — Plataforma de gestión de ventas para negocios
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }
  private async getPasswordResetTemplate(
    resetLink: string,
    fullName: string,
  ): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recuperación de contraseña - Balancio</title>
</head>

<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #1e3a5f; letter-spacing: -0.5px;">
                💰 Balancio
              </h1>
            </td>
          </tr>

          <!-- Card Container -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">

              <!-- Title -->
              <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1e3a5f; text-align: center;">
                Recuperación de contraseña
              </h2>

              <!-- Subtitle -->
              <p style="margin: 0 0 32px 0; font-size: 15px; color: #6b7280; text-align: center; line-height: 1.5;">
                Hola ${fullName}, recibimos una solicitud para restablecer tu contraseña.
              </p>

              <!-- Helper Text -->
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280; text-align: center;">
                Hacé clic en el siguiente botón para crear una nueva contraseña:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a5f; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 10px; font-size: 16px; font-weight: 600;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-align: center;">
                Si no podés hacer clic en el botón, copiá y pegá este enlace:
              </p>
              <p style="margin: 0 0 32px 0; font-size: 13px; color: #1e3a5f; word-break: break-all; text-align: center; line-height: 1.5;">
                ${resetLink}
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #9ca3af; text-align: center;">
                      Este enlace es válido durante 1 hora.
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center; line-height: 1.5;">
                      Si no realizaste esta acción, podés ignorar este correo de forma segura.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2025 Balancio — Plataforma de gestión de ventas para negocios
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }
}
