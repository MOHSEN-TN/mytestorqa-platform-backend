// src/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  count() {
    return this.prisma.user.count();
  }

  async findAll(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return { data: user };
  }

  async createUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const tempPassword = this.generateSecurePassword(12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as RoleType,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    try {
      await this.mailService.sendNewPassword(data.email, tempPassword);
    } catch (error) {
      this.logger.error(
        `Email non envoyé à ${data.email}, mais utilisateur créé.`,
        error,
      );
    }

    return {
      data: user,
      message: 'Utilisateur créé avec succès',
      temporaryPassword: tempPassword,
    };
  }

  async updateUser(
    id: string,
    data: { firstName?: string; lastName?: string; role?: string },
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.role && { role: data.role as RoleType }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      data: updatedUser,
      message: 'Utilisateur mis à jour avec succès',
    };
  }

  async deleteUser(id: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'Utilisateur supprimé avec succès',
    };
  }

  async resetUserPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const newPassword = this.generateSecurePassword(12);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    try {
      await this.mailService.sendNewPassword(user.email, newPassword);
    } catch (error) {
      this.logger.error(
        `Email de réinitialisation non envoyé à ${user.email}.`,
        error,
      );
    }

    return {
      message: 'Mot de passe réinitialisé avec succès',
      newPassword,
    };
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

  async changePassword(email: string, oldPassword: string, newPassword: string) {
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

  async sendForgotPasswordOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { message: 'Si cet email existe, un code vous a été envoyé.' };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiry },
    });

    try {
      await this.mailService.sendOtp(email, otpCode);
    } catch (error) {
      this.logger.error(`OTP non envoyé à ${email}.`, error);
    }

    return {
      message: 'Si cet email existe, un code vous a été envoyé.',
      otpCode,
    };
  }

  async verifyOtpAndResetPassword(email: string, otpCode: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.otpCode || !user.otpExpiry) {
      throw new BadRequestException('Code invalide ou expiré.');
    }

    if (new Date() > user.otpExpiry) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null },
      });

      throw new BadRequestException('Code expiré. Veuillez recommencer.');
    }

    if (user.otpCode !== otpCode) {
      throw new BadRequestException('Code incorrect.');
    }

    const newPassword = this.generateSecurePassword(12);
    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        otpCode: null,
        otpExpiry: null,
      },
    });

    try {
      await this.mailService.sendNewPassword(email, newPassword);
    } catch (error) {
      this.logger.error(`Nouveau mot de passe non envoyé à ${email}.`, error);
    }

    return {
      message: 'Mot de passe réinitialisé.',
      newPassword,
    };
  }

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