// src/users/users.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('name') name?: string,
  ) {
    return this.usersService.findAll({
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 10,
      search: search || name,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      oldPassword: string;
      newPassword: string;
    },
  ) {
    return this.usersService.changePassword(
      req.user.email,
      body.oldPassword,
      body.newPassword,
    );
  }

  // Demande publique. La réponse reste volontairement générique.
  @Post('forgot-password')
  requestForgotPassword(
    @Body()
    body: {
      email: string;
      locale?: string;
    },
  ) {
    return this.usersService.requestPasswordResetByEmail(
      body.email,
      body.locale,
    );
  }

  // Cette route statique doit rester avant les routes dynamiques :id.
  @Post('password-reset/confirm')
  confirmPasswordReset(
    @Body()
    body: {
      token: string;
      newPassword: string;
      confirmPassword: string;
    },
  ) {
    return this.usersService.confirmPasswordReset(
      body,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  createUser(
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      locale?: string;
    },
  ) {
    return this.usersService.createUser(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/reset-password')
  resetUserPassword(
    @Param('id') id: string,
    @Body() body?: { locale?: string },
  ) {
    return this.usersService.requestPasswordResetByUserId(
      id,
      body?.locale,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  getUser(
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    },
  ) {
    return this.usersService.updateUser(
      id,
      body,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  deleteUser(
    @Param('id') id: string,
  ) {
    return this.usersService.deleteUser(id);
  }
}