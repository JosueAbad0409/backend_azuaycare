import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginDto } from './dto/login.dto';

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
  login(@Body() LoginDto: LoginDto){
    return this.authService.login(LoginDto);
  }
}