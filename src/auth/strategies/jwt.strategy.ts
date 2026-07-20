import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: { sub: string; email: string; rol: string }) {
    // Rendimiento: Solo seleccionamos los campos necesarios de la consulta SQL
    const usuario = await this.usuariosRepository.findOne({
      where: { id: payload.sub },
      select: {
        id: true,
        email_institucional: true,
        fecha_desactivacion: true,
        carrera_id: true,
      },
      relations: { rol: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no autorizado o inexistente.');
    }

    if (usuario.fecha_desactivacion) {
      throw new UnauthorizedException('Su cuenta de usuario ha sido desactivada.');
    }

    return {
      id: usuario.id,
      email: usuario.email_institucional,
      rol: usuario.rol?.nombre ?? 'INVITADO',
      carrera_id: usuario.carrera_id ?? null,
    };
  }
}
