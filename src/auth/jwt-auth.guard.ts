import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

type AuthenticatedUser = {
  userId: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: unknown,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const authenticatedUser = super.handleRequest<AuthenticatedUser>(
      err,
      user,
      info,
      context,
      status,
    );

    if (authenticatedUser?.role === RoleType.VIEWER) {
      const request = context.switchToHttp().getRequest<Request>();

      if (!this.isViewerRequestAllowed(request)) {
        throw new ForbiddenException(
          'Accès refusé : le rôle Viewer est limité à la consultation.',
        );
      }
    }

    return authenticatedUser as TUser;
  }

  private isViewerRequestAllowed(request: Request): boolean {
    const method = request.method.toUpperCase();
    const path = request.path;

    // Session courante.
    if (method === 'GET' && path === '/auth/me') {
      return true;
    }

    // Paramètres du compte : changement de son propre mot de passe.
    if (method === 'PATCH' && path === '/users/password') {
      return true;
    }

    // Projet : consultation de la liste des projets auxquels le Viewer appartient.
    if (method === 'GET' && path === '/projects') {
      return true;
    }

    // Dashboard : consultation uniquement. L'audit Lighthouse reste interdit
    // car il est exposé en POST /dashboard/:projectId/quality.
    if (method === 'GET' && path.startsWith('/dashboard/')) {
      return true;
    }

    // Rapports : consultation, aperçu et téléchargement uniquement.
    if (
      method === 'GET' &&
      (path === '/reports' || path.startsWith('/reports/'))
    ) {
      return true;
    }

    return false;
  }
}
