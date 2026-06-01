// src/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  count() {
    return this.prisma.user.count();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { email: string; password: string; role?: RoleType }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        role: data.role ?? RoleType.TESTER,
      },
    });
  }

  // ─── Changer mot de passe (connecté) ─────────────────────────────────────
  async changePassword(
    email: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('User not found');

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) throw new UnauthorizedException('Wrong password');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return { message: 'Password updated successfully' };
  }

  // ─── Step 1 : Envoyer OTP par email ──────────────────────────────────────
  async sendForgotPasswordOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // On retourne toujours un succès pour ne pas divulguer les emails existants
    if (!user) {
      return { message: 'Si cet email existe, un code vous a été envoyé.' };
    }

    // Générer un code OTP à 6 chiffres
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiry },
    });

    await this.mailService.sendOtp(email, otpCode);

    return { message: 'Si cet email existe, un code vous a été envoyé.' };
  }

  // ─── Step 2 : Vérifier OTP → générer nouveau mot de passe ────────────────
  async verifyOtpAndResetPassword(email: string, otpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.otpCode || !user.otpExpiry) {
      throw new BadRequestException('Code invalide ou expiré.');
    }

    // Vérifier expiration
    if (new Date() > user.otpExpiry) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null },
      });
      throw new BadRequestException('Code expiré. Veuillez recommencer.');
    }

    // Vérifier le code
    if (user.otpCode !== otpCode) {
      throw new BadRequestException('Code incorrect.');
    }

    // Générer un mot de passe aléatoire sécurisé (12 caractères)
    const newPassword = this.generateSecurePassword(12);

    // Hasher et sauvegarder
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        otpCode: null,   // Invalider l'OTP
        otpExpiry: null,
      },
    });

    // Envoyer le nouveau mot de passe par email
    await this.mailService.sendNewPassword(email, newPassword);

    return { message: 'Mot de passe réinitialisé. Vérifiez votre email.' };
  }

  // ─── Utilitaire : générer un mot de passe sécurisé ───────────────────────
  private generateSecurePassword(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}