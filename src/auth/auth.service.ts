import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginGoogleDto } from './dto/login-google.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly googleClient: OAuth2Client;
  private readonly rolesCache: Map<string, Role> = new Map();

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new InternalServerErrorException(
        'Falta la configuración GOOGLE_CLIENT_ID en las variables de entorno.',
      );
    }
    this.googleClient = new OAuth2Client(googleClientId);
  }

  async onModuleInit() {
    try {
      const nombresRoles = ['ESTUDIANTE', 'INVITADO', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'];
      for (const nombre of nombresRoles) {
        const rol = await this.rolesRepository.findOne({ where: { nombre } });
        if (rol) {
          this.rolesCache.set(nombre, rol);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.warn('Advertencia: No se pudo pre-cargar los roles en memoria.', message);
    }
  }

  async loginWithGoogle(loginGoogleDto: LoginGoogleDto) {
    try {
      let email = '';
      let googleId = '';

      let primerNombre = 'Usuario';
      let segundoNombre: string | null = null;
      let primerApellido = 'Azuay';
      let segundoApellido: string | null = null;
      let fotoGoogle: string | null = null;

      if (process.env.ALLOW_TEST_LOGIN === 'true' && loginGoogleDto.emailTest) {
        email = loginGoogleDto.emailTest.toLowerCase().trim();
        googleId = `TEST_${email}`;
      } else {
        if (!loginGoogleDto.token) {
          throw new UnauthorizedException('El idToken de Google es requerido.');
        }

        const ticket = await this.googleClient.verifyIdToken({
          idToken: loginGoogleDto.token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.email || !payload.sub) {
          throw new UnauthorizedException('Token de Google inválido o expirado.');
        }

        email = payload.email.toLowerCase().trim();
        googleId = payload.sub;
        fotoGoogle = payload.picture ?? null;

        const rawGiven = (payload.given_name ?? 'Usuario').trim().split(' ');
        primerNombre = rawGiven[0];
        segundoNombre = rawGiven.length > 1 ? rawGiven.slice(1).join(' ') : null;

        const rawFamily = (payload.family_name ?? 'Azuay').trim().split(' ');
        primerApellido = rawFamily[0];
        segundoApellido = rawFamily.length > 1 ? rawFamily.slice(1).join(' ') : null;
      }

      let nombreRolAsignado = 'INVITADO';
      const administradoresPrueba: Record<string, string> = {
        'admin.bienestar@gmail.com': 'COORDINADOR_BIENESTAR',
        'admin.carrera@gmail.com': 'COORDINADOR_CARRERA',
        'josue.abad@gmail.com': 'COORDINADOR_BIENESTAR',
      };

      if (administradoresPrueba[email]) {
        nombreRolAsignado = administradoresPrueba[email];
      } else {
        const esDominioInstitucional = email.endsWith('@tecazuay.edu.ec');
        if (esDominioInstitucional) {
          const esEstudianteRegular = /\.est@tecazuay\.edu\.ec$/.test(email);
          nombreRolAsignado = esEstudianteRegular ? 'ESTUDIANTE' : 'COORDINADOR_CARRERA';
        }
      }

      let usuario = await this.usuariosRepository.findOne({
        where: [
          { google_id: googleId },
          { email_institucional: email }
        ],
        select: {
          id: true,
          google_id: true,
          email_institucional: true,
          primer_nombre: true,
          primer_apellido: true,
          cedula: true,
          carrera_id: true,
          ciclo_id: true,
          foto_url: true,
          foto_personalizada: true,
        },
        relations: { rol: true },
      });

      if (!usuario) {
        if (nombreRolAsignado === 'COORDINADOR_CARRERA' && !administradoresPrueba[email]) {
          throw new UnauthorizedException(
            'Tu correo no está registrado como Coordinador autorizado. Un administrador debe crear tu cuenta previamente.'
          );
        }
        
        let rolDb = this.rolesCache.get(nombreRolAsignado);
        if (!rolDb) {
          const rolEncontrado = await this.rolesRepository.findOne({ where: { nombre: nombreRolAsignado } });
          if (!rolEncontrado) {
            throw new InternalServerErrorException(
              `El rol "${nombreRolAsignado}" no está configurado en el sistema.`,
            );
          }
          rolDb = rolEncontrado;
          this.rolesCache.set(nombreRolAsignado, rolDb);
        }

        usuario = this.usuariosRepository.create({
          google_id: googleId,
          email_institucional: email,
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido,
          foto_url: fotoGoogle,
          rol: rolDb,
        });

        await this.usuariosRepository.save(usuario);
      } else {
        let necesitaActualizar = false;

        if (!usuario.google_id) {
          usuario.google_id = googleId;
          necesitaActualizar = true;
        }

        if (usuario.primer_nombre === 'Usuario' && primerNombre !== 'Usuario') {
          usuario.primer_nombre = primerNombre;
          usuario.segundo_nombre = segundoNombre;
          usuario.primer_apellido = primerApellido;
          usuario.segundo_apellido = segundoApellido;
          necesitaActualizar = true;
        }

        if (!usuario.foto_personalizada && fotoGoogle && usuario.foto_url !== fotoGoogle) {
          usuario.foto_url = fotoGoogle;
          necesitaActualizar = true;
        }

        if (necesitaActualizar) {
          await this.usuariosRepository.save(usuario);
        }
      }

      const accessToken = this.jwtService.sign({
        sub: usuario.id,
        email: usuario.email_institucional,
        rol: usuario.rol?.nombre ?? nombreRolAsignado,
        carrera_id: usuario.carrera_id ?? null,
        nombre: `${usuario.primer_nombre} ${usuario.primer_apellido}`,
      });

      const rolFinal = usuario.rol?.nombre ?? nombreRolAsignado;
      const rolesQueCompletanPerfil = ['ESTUDIANTE', 'INVITADO'];
      
      const perfilCompleto =
        !rolesQueCompletanPerfil.includes(rolFinal) ||
        Boolean(
          usuario.cedula &&
            (rolFinal !== 'ESTUDIANTE' || (usuario.carrera_id && usuario.ciclo_id)),
        );

      return {
        message: 'Autenticación exitosa',
        accessToken,
        usuario: {
          id: usuario.id,
          email: usuario.email_institucional,
          nombre: `${usuario.primer_nombre} ${usuario.primer_apellido}`,
          rol: rolFinal,
          cedula: usuario.cedula ?? null,
          carrera_id: usuario.carrera_id ?? null,
          ciclo_id: usuario.ciclo_id ?? null,
          foto_url: usuario.foto_url ?? null,
        },
        perfilCompleto,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      console.error('Error de Google:', error);
      throw new UnauthorizedException(`Error de autenticación. Verifique sus credenciales o contacte a soporte.`);
    }
  }
}