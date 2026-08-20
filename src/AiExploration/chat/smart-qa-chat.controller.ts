import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  CreateSmartQaChatSessionDto,
  SendSmartQaMessageDto,
} from './smart-qa-chat.dto';
import { SmartQaChatService } from './smart-qa-chat.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

@Controller('smart-qa')
@UseGuards(JwtAuthGuard)
export class SmartQaChatController {
  constructor(private readonly smartQaChatService: SmartQaChatService) {}

  @Get('status')
  getStatus() {
    return this.smartQaChatService.getStatus();
  }

  @Get('chat/sessions')
  listSessions(
    @Req() req: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
  ) {
    return this.smartQaChatService.listSessions(req.user, projectId);
  }

  @Post('chat/sessions')
  createSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSmartQaChatSessionDto,
  ) {
    return this.smartQaChatService.createSession(req.user, dto);
  }

  @Get('chat/sessions/:id/messages')
  getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.smartQaChatService.getMessages(req.user, id);
  }

  @Post('chat/messages')
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendSmartQaMessageDto,
  ) {
    return this.smartQaChatService.sendMessage(req.user, dto);
  }

  @Delete('chat/sessions/:id')
  deleteSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.smartQaChatService.deleteSession(req.user, id);
  }
}
