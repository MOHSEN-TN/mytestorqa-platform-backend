// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetLink(params: {
    to: string;
    resetUrl: string;
    firstName?: string | null;
    expiresInMinutes: number;
    accountActivation?: boolean;
  }): Promise<void> {
    const firstName = this.escapeHtml(params.firstName?.trim() || '');
    const resetUrl = this.escapeHtml(params.resetUrl);
    const title = params.accountActivation
      ? 'Activez votre compte SMART QA'
      : 'Réinitialisez votre mot de passe';
    const intro = params.accountActivation
      ? 'Votre compte SMART QA a été créé. Choisissez maintenant votre mot de passe.'
      : 'Une demande de réinitialisation de votre mot de passe a été effectuée.';
    const buttonLabel = params.accountActivation
      ? 'Choisir mon mot de passe'
      : 'Réinitialiser mon mot de passe';

    await this.transporter.sendMail({
      from: `"SMART QA" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: params.to,
      subject: `${params.accountActivation ? 'Bienvenue' : 'Réinitialisation'} - SMART QA`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6fb;padding:32px 16px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(15,23,42,.08);">
            <div style="font-size:20px;font-weight:800;color:#2563eb;margin-bottom:24px;">SMART QA</div>
            <h1 style="font-size:24px;line-height:1.3;color:#111827;margin:0 0 12px;">${title}</h1>
            <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 18px;">
              ${firstName ? `Bonjour ${firstName},<br><br>` : ''}${intro}
            </p>
            <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Ce lien expire dans <strong>${params.expiresInMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;">
                ${buttonLabel}
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:24px 0 8px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
            </p>
            <p style="word-break:break-all;color:#2563eb;font-size:12px;line-height:1.6;margin:0 0 24px;">${resetUrl}</p>
            <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
              Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
            </p>
          </div>
        </div>
      `,
    });

    this.logger.log(`Lien de réinitialisation envoyé à ${params.to}`);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
