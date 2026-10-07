import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type RequestWithCookies = Request & {
  cookies?: Record<string, unknown>;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: RequestWithCookies | undefined) => {
          const cookies = req?.cookies;
          if (!cookies || typeof cookies !== 'object') {
            return null;
          }

          const raw: unknown = cookies['accessToken'];
          return typeof raw === 'string' ? raw : null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET ?? 'dev_secret',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session utilisateur invalide.');
    }

    // Le rôle vient de la base à chaque requête : une modification faite par
    // l'administrateur prend effet immédiatement, sans attendre l'expiration JWT.
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
