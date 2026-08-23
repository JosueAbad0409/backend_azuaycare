import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PerfilUsuarioPeriodo } from 'src/usuarios/entities/perfil-usuario-periodo.entity';
import { PeriodoMatricula } from 'src/periodos-matricula/entities/periodos-matricula.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Role, PerfilUsuarioPeriodo, PeriodoMatricula]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET no está configurado en las variables de entorno.');
        }
        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}