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
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly googleClient: OAuth2Client;
  
  // Cacheamos los roles para no ir a buscarlos a la DB en cada login nuevo
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
      const ticket = await this.googleClient.verifyIdToken({
        idToken: loginGoogleDto.token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) {
        throw new UnauthorizedException('Token de Google inválido o expirado.');
      }

      const email = payload.email.toLowerCase().trim();
      const googleId = payload.sub;

      // 1. Clasificación del Correo por RegEx (Estudiante regular vs Invitado vs Coordinador)
      let nombreRolAsignado = 'INVITADO';
      const esDominioInstitucional = email.endsWith('@tecazuay.edu.ec');

      if (esDominioInstitucional) {
        const esEstudianteRegular = /\.est@tecazuay\.edu\.ec$/.test(email);
        nombreRolAsignado = esEstudianteRegular ? 'ESTUDIANTE' : 'COORDINADOR_CARRERA';
      }

      // 2. Proyección de base de datos: traemos solo columnas clave[cite: 1]
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
          carrera_id: true,
        },
        relations: { rol: true },
      });

      // 3. Auto-provisioning si es la primera vez que inicia sesión[cite: 1]
      if (!usuario) {
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
          primer_nombre: payload.given_name ?? 'Usuario',
          primer_apellido: payload.family_name ?? 'Azuay',
          rol: rolDb,
        });

        await this.usuariosRepository.save(usuario);
      } else if (!usuario.google_id) {
        // Vinculamos el Google ID si ya estaba pre-registrado en el sistema sin él[cite: 1]
        usuario.google_id = googleId;
        await this.usuariosRepository.save(usuario);
      }

      // 4. Firmar y retornar JWT[cite: 1]
      const accessToken = this.jwtService.sign({
        sub: usuario.id,
        email: usuario.email_institucional,
        rol: usuario.rol?.nombre ?? nombreRolAsignado,
        carrera_id: usuario.carrera_id ?? null,
      });

      return {
        message: 'Autenticación exitosa',
        accessToken,
        usuario: {
          id: usuario.id,
          email: usuario.email_institucional,
          nombre: `${usuario.primer_nombre} ${usuario.primer_apellido}`,
          rol: usuario.rol?.nombre ?? nombreRolAsignado,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new UnauthorizedException(`Error durante la verificación con Google: ${message}`);
    }
  }


  async login(loginDto: LoginDto) {
    // Si llegas aquí, significa que el ValidationPipe aprobó el email y password
    return {
      message: '¡Validación superada!',
      datos_recibidos: loginDto
    };
  }

}