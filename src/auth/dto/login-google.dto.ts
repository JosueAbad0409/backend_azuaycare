import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginGoogleDto {
  @IsString()
  @IsOptional() 
  token?: string;

  @IsEmail({}, { message: 'El correo de pruebas no es válido.' })
  @IsOptional()
  emailTest?: string;
}

