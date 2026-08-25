import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginLocalDto } from './dto/login-local.dto';
import { RegistroLocalDto } from './dto/registro-local.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login-google')
  @HttpCode(HttpStatus.OK)
  loginGoogle(@Body() loginGoogleDto: LoginGoogleDto) {
    return this.authService.loginWithGoogle(loginGoogleDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  loginLocal(@Body() loginLocalDto: LoginLocalDto) {
    return this.authService.loginLocal(loginLocalDto);
  }

  @Post('registro')
  registroLocal(@Body() registroDto: RegistroLocalDto) {
    return this.authService.registroLocal(registroDto);
  }
}