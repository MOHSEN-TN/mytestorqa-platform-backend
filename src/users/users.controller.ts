// src/users/users.controller.ts
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('name') name?: string,
  ) {
    const searchTerm = search || name;

    return this.usersService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search: searchTerm,
    });
  }

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

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.usersService.sendForgotPasswordOtp(body.email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otpCode: string }) {
    return this.usersService.verifyOtpAndResetPassword(
      body.email,
      body.otpCode,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createUser(
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    },
  ) {
    return this.usersService.createUser(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/reset-password')
  async resetUserPassword(@Param('id') id: string) {
    return this.usersService.resetUserPassword(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; role?: string },
  ) {
    return this.usersService.updateUser(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}