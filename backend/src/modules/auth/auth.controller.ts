import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from './current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './interfaces/auth-user.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout() {
    return this.authService.logout();
  }

  @Post('password/reset-request')
  resetRequest(@Body() payload: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(payload);
  }

  @Post('password/reset-confirm')
  resetConfirm(@Body() payload: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(payload);
  }

  @Post('telegram/login')
  @ApiOkResponse({ type: AuthResponseDto })
  telegramLogin(@Body() payload: TelegramLoginDto) {
    return this.authService.telegramLogin(payload);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }
}
