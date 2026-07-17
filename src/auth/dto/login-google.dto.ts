import { IsNotEmpty, IsString } from 'class-validator';

export class LoginGoogleDto {
  @IsString()
  @IsNotEmpty({ message: 'El idToken de Google es requerido.' })
  token: string;
}