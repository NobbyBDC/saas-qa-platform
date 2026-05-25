import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new organization and admin user' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: any, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @Post('refresh')
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshToken(token);
  }

  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Body('refreshToken') token: string) {
    return this.authService.logout(token);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }
}
