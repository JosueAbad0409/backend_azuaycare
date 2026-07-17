import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Role } from './roles/entities/role.entity';
import { RolesModule } from './roles/roles.module';
import { Usuario } from './usuarios/entities/usuario.entity';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: Number(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: String(configService.get<string>('DB_PASSWORD') ?? ''),
        database: configService.get<string>('DB_DATABASE') ?? 'postgres',
        entities: [Usuario, Role],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') !== 'production',
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    RolesModule,
    UsuariosModule,
    AuthModule,
  ],
})
export class AppModule {}
