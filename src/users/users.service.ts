// src/users/users.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly resetTokenDurationMs = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  count() {
    return this.prisma.user.count();
  }

  async findAll(params: { page: number; limit: number; search?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where = params.search
      ? {
          OR: [
            {
              email: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
            {
              firstName: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
            {
              lastName: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
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
    locale?: string;
  }) {
    const email = data.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Le mot de passe initial n'est jamais communiqué. L'utilisateur le choisit
    // depuis le lien sécurisé reçu par email.
    const unusablePassword = randomBytes(48).toString('hex');
    const hashedPassword = await bcrypt.hash(unusablePassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
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

    let activationEmailSent = true;

    try {
      await this.sendPasswordResetLink(user, data.locale, true);
    } catch (error) {
      activationEmailSent = false;
      this.logger.error(
        `Compte créé mais email d'activation non envoyé à ${email}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      data: user,
      message: activationEmailSent
        ? "Utilisateur créé. Un lien lui a été envoyé afin qu'il choisisse son mot de passe."
        : "Utilisateur créé, mais l'email n'a pas pu être envoyé. Utilisez le bouton de réinitialisation pour réessayer.",
    };
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    },
  ) {
    const existingUser = await this.prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    let normalizedEmail: string | undefined;

    if (data.email !== undefined) {
      normalizedEmail = data.email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new BadRequestException("L'email est requis");
      }

      const userWithSameEmail = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (userWithSameEmail && userWithSameEmail.id !== id) {
        throw new ConflictException(
          'Un utilisateur avec cet email existe déjà',
        );
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(normalizedEmail !== undefined && { email: normalizedEmail }),
        ...(data.firstName !== undefined && {
          firstName: data.firstName.trim(),
        }),
        ...(data.lastName !== undefined && {
          lastName: data.lastName.trim(),
        }),
        ...(data.role !== undefined && { role: data.role as RoleType }),
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
    const existingUser = await this.prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Utilisateur supprimé avec succès' };
  }

  async requestPasswordResetByUserId(id: string, locale?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.sendPasswordResetLink(user, locale, false);

    return {
      message: `Un lien de réinitialisation a été envoyé à ${user.email}.`,
    };
  }

  async requestPasswordResetByEmail(email: string, locale?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    if (user) {
      try {
        await this.sendPasswordResetLink(user, locale, false);
      } catch (error) {
        this.logger.error(
          `Email de réinitialisation non envoyé à ${normalizedEmail}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    // Ne pas révéler si l'adresse existe.
    return {
      message:
        'Si cet email existe, un lien de réinitialisation a été envoyé.',
    };
  }

  async confirmPasswordReset(data: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (!data.token?.trim()) {
      throw new BadRequestException('Token manquant.');
    }

    if (data.newPassword !== data.confirmPassword) {
      throw new BadRequestException(
        'La confirmation du mot de passe ne correspond pas.',
      );
    }

    this.validatePassword(data.newPassword);

    const tokenHash = this.hashToken(data.token.trim());
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Lien invalide ou expiré.');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          otpCode: null,
          otpExpiry: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    return {
      message: 'Votre mot de passe a été défini avec succès.',
    };
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  create(data: { email: string; password: string; role?: RoleType }) {
    return this.prisma.user.create({
      data: {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: data.role ?? RoleType.TESTER,
      },
    });
  }

  async changePassword(email: string, oldPassword: string, newPassword: string) {
    this.validatePassword(newPassword);

    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    const validOldPassword = await bcrypt.compare(oldPassword, user.password);

    if (!validOldPassword) {
      throw new UnauthorizedException('Ancien mot de passe incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    return { message: 'Mot de passe mis à jour avec succès' };
  }

  private async sendPasswordResetLink(
    user: { id: string; email: string; firstName: string | null },
    locale?: string,
    accountActivation = false,
  ) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.resetTokenDurationMs);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const safeLocale = locale === 'en' ? 'en' : 'fr';
    const frontendUrl = (
      process.env.FRONTEND_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/${safeLocale}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.mailService.sendPasswordResetLink({
        to: user.email,
        resetUrl,
        firstName: user.firstName,
        expiresInMinutes: 15,
        accountActivation,
      });
    } catch (error) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });
      throw error;
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private validatePassword(password: string) {
    const valid =
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!valid) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
      );
    }
  }
}
