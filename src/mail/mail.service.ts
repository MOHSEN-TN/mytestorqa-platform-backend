// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true pour port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"SMART QA" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to,
      subject: '🔐 Votre code de vérification - SMART QA',
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fe;border-radius:16px;">
          <h2 style="color:#1a1a2e;margin-bottom:8px;">Réinitialisation du mot de passe</h2>
          <p style="color:#6b7280;font-size:14px;">Utilisez ce code pour vérifier votre identité. Il expire dans <strong>10 minutes</strong>.</p>
          <div style="background:#fff;border:2px solid #7c6eff;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#6c5ce7;">${code}</span>
          </div>
          <p style="color:#9ca3af;font-size:12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
      `,
    });
    this.logger.log(`OTP envoyé à ${to}`);
  }

  async sendNewPassword(to: string, newPassword: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"SMART QA" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to,
      subject: '✅ Votre nouveau mot de passe - SMART QA',
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fe;border-radius:16px;">
          <h2 style="color:#1a1a2e;margin-bottom:8px;">Votre nouveau mot de passe</h2>
          <p style="color:#6b7280;font-size:14px;">Votre mot de passe a été réinitialisé avec succès. Voici vos nouvelles informations de connexion :</p>
          <div style="background:#fff;border:2px solid #10b981;border-radius:12px;padding:20px;margin:24px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;">Nouveau mot de passe :</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;font-family:monospace;color:#1a1a2e;letter-spacing:2px;">${newPassword}</p>
          </div>
          <p style="color:#ef4444;font-size:13px;">⚠️ Pensez à changer ce mot de passe après votre prochaine connexion via <strong>Paramètres → Changer le mot de passe</strong>.</p>
        </div>
      `,
    });
    this.logger.log(`Nouveau mot de passe envoyé à ${to}`);
  }
}