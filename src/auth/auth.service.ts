import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {    
    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const ok = await bcrypt.compare(password, user.password);    
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }    
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async ensureAdmin() {
    const count = await this.users.count();
    if (count > 0) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is not defined');
    }

    const hashed = await bcrypt.hash(password, 10);

    await this.users.create({
      email,
      password: hashed,
      role: RoleType.ADMIN,
    });

  }
}