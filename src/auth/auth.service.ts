import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Role } from '../roles/entities/role.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PerfilUsuarioPeriodo } from '../usuarios/entities/perfil-usuario-periodo.entity';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';

// ✅ IMPORTA TU ENTIDAD CARRERA (Ajusta la ruta si es necesario)
import { Carrera } from '../carreras/entities/carrera.entity'; 

import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginLocalDto } from './dto/login-local.dto';
import { RegistroLocalDto } from './dto/registro-local.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly googleClient: OAuth2Client;
  private readonly rolesCache: Map<string, Role> = new Map();

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(PerfilUsuarioPeriodo)
    private readonly perfilPeriodoRepository: Repository<PerfilUsuarioPeriodo>,
    @InjectRepository(PeriodoMatricula)
    private readonly periodosRepository: Repository<PeriodoMatricula>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    
    // ✅ INYECTAMOS EL REPOSITORIO DE CARRERA
    @InjectRepository(Carrera)
    private readonly carrerasRepository: Repository<Carrera>,
    
    private readonly jwtService: JwtService,
  ) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      throw new InternalServerErrorException('Falta la configuración GOOGLE_CLIENT_ID.');
    }
    this.googleClient = new OAuth2Client(googleClientId);
  }

  async onModuleInit() {
    try {
      const nombresRoles = ['ESTUDIANTE', 'INVITADO', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA'];
      for (const nombre of nombresRoles) {
        const rol = await this.rolesRepository.findOne({ where: { nombre } });
        if (rol) this.rolesCache.set(nombre, rol);
      }
    } catch (error) {
      console.warn('Advertencia: No se pudo pre-cargar los roles en memoria.');
    }
  }

  // ==========================================
  // LÓGICA CENTRALIZADA PARA DETERMINAR ROLES
  // ==========================================
  private async determinarRolPorEmail(email: string): Promise<string> {
    const administradoresPrueba: Record<string, string> = {
      'admin.bienestar@gmail.com': 'COORDINADOR_BIENESTAR',
      'admin.carrera@gmail.com': 'COORDINADOR_CARRERA',
      'josue.abad@gmail.com': 'COORDINADOR_BIENESTAR',
      'lunasteven282@gmail.com': 'COORDINADOR_BIENESTAR',
    };

    // 1. Si está en la lista quemada (para pruebas o fijos)
    if (administradoresPrueba[email]) {
      return administradoresPrueba[email];
    }

    // 2. Validar Bienestar Institucional Oficial
    if (email === 'bienestar.institucional@tecazuay.edu.ec') {
      return 'COORDINADOR_BIENESTAR';
    }

    // 3. Validar si es Coordinador de Carrera consultando la base de datos
    const esCoordinador = await this.carrerasRepository.findOne({
      where: { correo_institucional: email },
      select: { id: true }
    });
    
    if (esCoordinador) {
      return 'COORDINADOR_CARRERA';
    }

    // 4. Analizar el dominio y prefijo para Estudiantes vs Invitados
    const dominio = email.split('@')[1] ?? '';
    const usuarioLocal = email.split('@')[0] ?? '';

    if (usuarioLocal.endsWith('.est') || dominio === 'est.tecazuay.edu.ec') {
      return 'ESTUDIANTE';
    }

    // 5. Cualquier otro caso (@gmail.com, docentes normales sin cargo, etc.)
    return 'INVITADO';
  }

  // ==========================================
  // FLUJO GOOGLE
  // ==========================================
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
        if (!loginGoogleDto.token) throw new UnauthorizedException('El idToken de Google es requerido.');

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

        // ✅ MEJORA: Usar 'name' completo como respaldo si 'given_name' no existe
        const nombreCompleto = payload.name ? payload.name.trim().split(' ') : [];
        const fallbackGiven = nombreCompleto[0] || 'Usuario';
        const fallbackFamily = nombreCompleto.length > 1 ? nombreCompleto.slice(1).join(' ') : 'Azuay';

        // ✅ MEJORA: Extraer nombres con los nuevos respaldos
        const rawGiven = (payload.given_name ?? fallbackGiven).trim().split(' ');
        primerNombre = rawGiven[0];
        segundoNombre = rawGiven.length > 1 ? rawGiven.slice(1).join(' ') : null;

        // ✅ MEJORA: Extraer apellidos con los nuevos respaldos
        const rawFamily = (payload.family_name ?? fallbackFamily).trim().split(' ');
        primerApellido = rawFamily[0];
        segundoApellido = rawFamily.length > 1 ? rawFamily.slice(1).join(' ') : null;
      }

      // ✅ ASIGNACIÓN INTELIGENTE DEL ROL
      const nombreRolAsignado = await this.determinarRolPorEmail(email);

      let usuario = await this.usuariosRepository.findOne({
        where: [{ google_id: googleId }, { email_institucional: email }],
        select: {
          id: true, google_id: true, email_institucional: true, primer_nombre: true,
          primer_apellido: true, cedula: true, carrera_id: true, ciclo_id: true,
          foto_url: true, foto_personalizada: true,
        },
        relations: { rol: true },
      });

      if (!usuario) {
        let rolDb: Role | null | undefined = this.rolesCache.get(nombreRolAsignado);
        if (!rolDb) {
          rolDb = await this.rolesRepository.findOne({ where: { nombre: nombreRolAsignado } });
          if (rolDb) {
            this.rolesCache.set(nombreRolAsignado, rolDb);
          } else {
            throw new InternalServerErrorException(`El rol "${nombreRolAsignado}" no existe.`);
          }
        }

        usuario = this.usuariosRepository.create({
          google_id: googleId,
          email_institucional: email,
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido,
          foto_url: fotoGoogle,
          rol: { id: rolDb.id } as Role,
        });

        await this.usuariosRepository.save(usuario);
        usuario.rol = rolDb; 
      } else {
        // CASO: Ya existía en BD (ej. Se registró antes con contraseña). Le vinculamos Google.
        let necesitaActualizar = false;
        
        if (!usuario.google_id) { 
          usuario.google_id = googleId; 
          necesitaActualizar = true; 
        }
        
        // Si antes guardó 'Usuario', actualizamos con el nombre real de Google
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
        
        if (necesitaActualizar) await this.usuariosRepository.save(usuario);
      }

      return this.generarRespuestaLogin(usuario, usuario.rol?.nombre ?? nombreRolAsignado);

    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Error interno al registrar o autenticar usuario.');
    }
  }

  // ==========================================
  // FLUJO LOCAL (CORREO Y CONTRASEÑA)
  // ==========================================
  async registroLocal(registroDto: RegistroLocalDto) {
    const { email, password } = registroDto;
    const emailLimpio = email.toLowerCase().trim();

    // 1. Buscamos al usuario forzando traer la contraseña para verificar su estado
    const usuarioExistente = await this.usuariosRepository.createQueryBuilder('usuario')
      .addSelect('usuario.password')
      .where('usuario.email_institucional = :email', { email: emailLimpio })
      .getOne();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. ¿El usuario ya existe?
    if (usuarioExistente) {
      if (usuarioExistente.password) {
        throw new UnauthorizedException('Este correo ya está registrado y tiene una contraseña. Por favor, inicia sesión.');
      } else {
        // CASO: Entró con Google antes, pero no tiene contraseña local. ¡Se la asignamos!
        usuarioExistente.password = hashedPassword;
        await this.usuariosRepository.save(usuarioExistente);
        return { 
          message: 'Contraseña vinculada exitosamente a tu cuenta de Google. Ya puedes iniciar sesión aquí.' 
        };
      }
    }

    // 3. Si el usuario NO existe, lo creamos desde cero
    // ✅ ASIGNACIÓN INTELIGENTE DEL ROL
    const nombreRolAsignado = await this.determinarRolPorEmail(emailLimpio);

    let rolDb: Role | null | undefined = this.rolesCache.get(nombreRolAsignado);
    if (!rolDb) {
      rolDb = await this.rolesRepository.findOne({ where: { nombre: nombreRolAsignado } });
      if (rolDb) {
        this.rolesCache.set(nombreRolAsignado, rolDb);
      } else {
        throw new InternalServerErrorException(`El rol "${nombreRolAsignado}" no existe.`);
      }
    }

    // ✅ MEJORA: Extraer un nombre temporal con sentido a partir del correo
    const prefijoCorreo = emailLimpio.split('@')[0];
    const partesCorreo = prefijoCorreo.split(/[\.\-_]/); // Divide por punto, guion o guion bajo
    const nombreDesdeEmail = partesCorreo[0];
    const apellidoDesdeEmail = partesCorreo.length > 1 ? partesCorreo[1] : 'Nuevo';

    const nombreCapitalizado = nombreDesdeEmail.charAt(0).toUpperCase() + nombreDesdeEmail.slice(1);
    const apellidoCapitalizado = apellidoDesdeEmail.charAt(0).toUpperCase() + apellidoDesdeEmail.slice(1);

    const nuevoUsuario = this.usuariosRepository.create({
      email_institucional: emailLimpio,
      password: hashedPassword,
      primer_nombre: nombreCapitalizado || 'Usuario', // Se verá como 'Josue' en vez de 'Usuario'
      primer_apellido: apellidoCapitalizado || 'Nuevo',
      rol: { id: rolDb.id } as Role,
    });

    await this.usuariosRepository.save(nuevoUsuario);

    return {
      message: 'Usuario registrado exitosamente. Ya puedes iniciar sesión.',
    };
  }

  async loginLocal(loginLocalDto: LoginLocalDto) {
    const { email, password } = loginLocalDto;
    const emailLimpio = email.toLowerCase().trim();

    const usuario = await this.usuariosRepository.createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .addSelect('usuario.password')
      .where('usuario.email_institucional = :email', { email: emailLimpio })
      .getOne();

    if (!usuario) throw new UnauthorizedException('Credenciales incorrectas (Correo no encontrado).');
    
    if (!usuario.password) {
      throw new UnauthorizedException('Esta cuenta está vinculada a Google y no tiene contraseña. Usa el botón de Google, o ve a "Crear Cuenta" para asignarle una contraseña.');
    }

    const isPasswordValid = await bcrypt.compare(password, usuario.password);
    if (!isPasswordValid) throw new UnauthorizedException('Credenciales incorrectas (Contraseña inválida).');

    return this.generarRespuestaLogin(usuario, usuario.rol?.nombre ?? 'INVITADO');
  }

  // ==========================================
  // HELPER PARA EVITAR CÓDIGO REPETIDO
  // ==========================================
  private async generarRespuestaLogin(usuario: Usuario, rolFinal: string) {
    const accessToken = this.jwtService.sign({
      sub: usuario.id,
      email: usuario.email_institucional,
      rol: rolFinal,
      carrera_id: usuario.carrera_id ?? null,
      nombre: `${usuario.primer_nombre} ${usuario.primer_apellido}`,
      foto_url: usuario.foto_url ?? null,
      cedula: usuario.cedula ?? null,
    });

    const rolesQueCompletanPerfil = ['ESTUDIANTE', 'INVITADO'];
    let perfilCompleto = true;
    
    if (rolesQueCompletanPerfil.includes(rolFinal)) {
      const identidadOk = Boolean(usuario.cedula && usuario.carrera_id && usuario.ciclo_id);
      let perfilPeriodoOk = false;
      
      if (identidadOk) {
        const periodoActivo = await this.periodosRepository.findOne({
          where: { activo: true, fecha_desactivacion: IsNull() },
          order: { fecha_inicio: 'DESC' },
        });
        if (periodoActivo) {
          const perfilPeriodo = await this.perfilPeriodoRepository.findOne({
            where: { usuario_id: usuario.id, periodo_id: periodoActivo.id },
            select: { id: true },
          });
          perfilPeriodoOk = !!perfilPeriodo;
        }
      }
      perfilCompleto = identidadOk && perfilPeriodoOk;
    }

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
  }
}