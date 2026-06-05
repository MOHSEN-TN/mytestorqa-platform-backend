import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;

    // Debug logging
    console.log('=== RolesGuard Debug ===');
    console.log('Required roles:', roles);
    console.log('User object:', user);
    console.log('User role:', user?.role);
    console.log('Access granted:', user?.role && roles.includes(user.role));
    console.log('========================');

    return typeof user?.role === 'string' && roles.includes(user.role);
  }
}