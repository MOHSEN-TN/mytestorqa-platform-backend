// src/users/users.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectRole, RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly resetTokenDurationMs = 15 * 60 * 1000;

  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    createdAt: true,
    memberships: {
      select: {
        projectId: true,
        role: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' as const },
    },
  } as const;

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
        select: this.userSelect,
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
      select: this.userSelect,
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
    projectId?: string;
    locale?: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const role = this.parseRole(data.role);
    const viewerProjectId = data.projectId?.trim() || undefined;

    if (role === RoleType.VIEWER) {
      if (!viewerProjectId) {
        throw new BadRequestException(
          'Un projet doit être sélectionné pour un utilisateur Viewer.',
        );
      }

      await this.assertProjectExists(viewerProjectId);
    }

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
        role,
        ...(role === RoleType.VIEWER && viewerProjectId
          ? {
              memberships: {
                create: {
                  projectId: viewerProjectId,
                  role: ProjectRole.VIEWER,
                },
              },
            }
          : {}),
      },
      select: this.userSelect,
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
      projectId?: string;
    },
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { role: ProjectRole.VIEWER },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

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

    const targetRole =
      data.role !== undefined ? this.parseRole(data.role) : existingUser.role;

    const requestedProjectId = data.projectId?.trim() || undefined;
    const currentViewerProjectId = existingUser.memberships[0]?.projectId;
    const viewerProjectId = requestedProjectId ?? currentViewerProjectId;

    if (targetRole === RoleType.VIEWER) {
      if (!viewerProjectId) {
        throw new BadRequestException(
          'Un projet doit être sélectionné pour un utilisateur Viewer.',
        );
      }

      await this.assertProjectExists(viewerProjectId);
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(normalizedEmail !== undefined && { email: normalizedEmail }),
          ...(data.firstName !== undefined && {
            firstName: data.firstName.trim(),
          }),
          ...(data.lastName !== undefined && {
            lastName: data.lastName.trim(),
          }),
          role: targetRole,
        },
      });

      if (targetRole === RoleType.VIEWER && viewerProjectId) {
        // Un Viewer représente un client en lecture seule : on conserve
        // uniquement le projet explicitement sélectionné pour éviter toute
        // fuite entre projets.
        await tx.projectMember.deleteMany({
          where: { userId: id },
        });

        await tx.projectMember.create({
          data: {
            userId: id,
            projectId: viewerProjectId,
            role: ProjectRole.VIEWER,
          },
        });
      } else if (existingUser.role === RoleType.VIEWER) {
        // Si le compte quitte le rôle Viewer, on conserve son projet actuel
        // mais on remet une responsabilité de projet cohérente avec son nouveau rôle.
        await tx.projectMember.updateMany({
          where: {
            userId: id,
            role: ProjectRole.VIEWER,
          },
          data: {
            role: this.projectRoleForUserRole(targetRole),
          },
        });
      }

      return updated;
    });

    const result = await this.prisma.user.findUnique({
      where: { id: updatedUser.id },
      select: this.userSelect,
    });

    return {
      data: result,
      message: 'Utilisateur mis à jour avec succès',
    };
  }

  async projectOptions() {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return { data: projects };
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

  private parseRole(role: string): RoleType {
    if (!Object.values(RoleType).includes(role as RoleType)) {
      throw new BadRequestException('Rôle utilisateur invalide.');
    }

    return role as RoleType;
  }

  private projectRoleForUserRole(role: RoleType): ProjectRole {
    switch (role) {
      case RoleType.ADMIN:
        return ProjectRole.OWNER;
      case RoleType.QA_LEAD:
        return ProjectRole.QA_LEAD;
      case RoleType.TESTER:
        return ProjectRole.TESTER;
      case RoleType.VIEWER:
        return ProjectRole.VIEWER;
    }

    return ProjectRole.TESTER;
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException('Projet Viewer introuvable.');
    }
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
