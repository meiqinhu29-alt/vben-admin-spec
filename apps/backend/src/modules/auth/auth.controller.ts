import type { AuthUser } from '../../common/decorators/current-user.decorator';

import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(200)
  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.userId);
  }

  @HttpCode(200)
  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
