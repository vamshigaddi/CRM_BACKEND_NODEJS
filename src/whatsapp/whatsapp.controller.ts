import { Body, Controller, Post, Get, Param, Query, UseGuards, HttpException, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../common/services/storage.service';

@Controller('api/v1/whatsapp')
export class WhatsappController {
  constructor(
    private whatsappService: WhatsappService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  async getConversations(@CurrentUser() user: any) {
    return this.whatsappService.getConversations(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/messages')
  async getMessages(@Param('id') conversationId: string, @CurrentUser() user: any) {
    return this.whatsappService.getMessages(user.tenantId, conversationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('send')
  async send(@Body() msgIn: any, @CurrentUser() user: any) {
    return this.whatsappService.sendMessage(msgIn, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }
    const url = await this.storageService.uploadFile(file, 'whatsapp');
    return { success: true, url, filename: file.originalname };
  }

  // META PUBLIC WEBHOOK
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const MY_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'secure_token_123';
    console.log(`WhatsApp Webhook Verification: mode=${mode}, token=${token}, challenge=${challenge}`);
    
    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
      return challenge;
    }
    
    console.error(`WhatsApp Webhook Verification FAILED. Expected token matching: ${MY_VERIFY_TOKEN.substring(0, 3)}...`);
    throw new HttpException('Invalid verify token', HttpStatus.FORBIDDEN);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // Process async to avoid Meta timeout, but return 200 immediately
    this.whatsappService.handleWebhook(body).catch(err => {
      console.error('WhatsApp Webhook Async Processing Error:', err.message);
    });
    return { success: true };
  }
}
