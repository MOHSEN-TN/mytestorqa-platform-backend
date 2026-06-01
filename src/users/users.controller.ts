// src/users/users.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin only ───────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  listUsers() {
    return { ok: true, message: 'Only ADMIN can access this route' };
  }

  // ─── Changer mot de passe (connecté) ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(
    @Req() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(
      req.user.email,
      body.oldPassword,
      body.newPassword,
    );
  }

  // ─── Step 1 : Demander un OTP (public) ───────────────────────────────────
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.usersService.sendForgotPasswordOtp(body.email);
  }

  // ─── Step 2 : Vérifier OTP + reset (public) ──────────────────────────────
  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otpCode: string }) {
    return this.usersService.verifyOtpAndResetPassword(
      body.email,
      body.otpCode,
    );
  }
}