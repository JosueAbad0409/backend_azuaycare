import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Ciclo } from '../ciclos/entities/ciclo.entity';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import { SexoEnum } from './enums/perfil-usuario.enum';
import { parseFechaNacimiento } from '../common/is-fecha-nacimiento.validator';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { PerfilUsuarioPeriodo } from './entities/perfil-usuario-periodo.entity';

@Injectable()
export class UsuariosService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
    @InjectRepository(PeriodoMatricula)
    private readonly periodosRepository: Repository<PeriodoMatricula>,
    @InjectRepository(PerfilUsuarioPeriodo)
    private readonly perfilPeriodoRepository: Repository<PerfilUsuarioPeriodo>,
  ) {
    // Instanciación manual del cliente de Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  async create(createUsuarioDto: CreateUsuarioDto) {
    const emailSanitizado = createUsuarioDto.email_institucional.toLowerCase().trim();

    const existe = await this.usuariosRepository.findOne({
      where: { email_institucional: emailSanitizado },
      select: { id: true },
    });

    if (existe) {
      throw new BadRequestException('El usuario con este correo electrónico ya está registrado.');
    }

    if (createUsuarioDto.cedula) {
      const cedulaExiste = await this.usuariosRepository.findOne({
        where: { cedula: createUsuarioDto.cedula },
        select: { id: true },
      });

      if (cedulaExiste) {
        throw new BadRequestException('La cédula ingresada ya está registrada en otro usuario.');
      }
    }

    if (createUsuarioDto.ciclo_id) {
      const ciclo = await this.ciclosRepository.findOne({
        where: { id: createUsuarioDto.ciclo_id, fecha_desactivacion: IsNull() },
        select: { id: true, carrera_id: true },
      });

      if (!ciclo) {
        throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
      }

      if (createUsuarioDto.carrera_id && ciclo.carrera_id !== createUsuarioDto.carrera_id) {
        throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
      }
    }

    const nuevoUsuario = this.usuariosRepository.create({
      ...createUsuarioDto,
      email_institucional: emailSanitizado,
    });

    return this.usuariosRepository.save(nuevoUsuario);
  }

  findAll(skip: number = 0, take: number = 1000) {
  const limiteReal = Math.min(Math.max(Number(take) || 1000, 1), 5000);
  const skipReal = Math.max(Number(skip) || 0, 0);

  return this.usuariosRepository.find({
    skip: skipReal,
    take: limiteReal,
    select: {
      id: true,
      email_institucional: true,
      primer_nombre: true,
      primer_apellido: true,
      segundo_nombre: true,
      segundo_apellido: true,
      cedula: true,
      rol_id: true,
      carrera_id: true,
      ciclo_id: true,
      foto_url: true,
      fecha_desactivacion: true,
    },
    relations: { 
      rol: true, 
      ciclo: true,
      carrera: true,
      coordinaciones: { carrera: true } 
    },
    order: { primer_nombre: 'ASC' }
  });
}

  async findOne(id: string) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { rol: true, ciclo: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario solicitado no existe o fue desactivado.');
    }

    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto) {
    const usuarioExistente = await this.usuariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      select: { id: true, carrera_id: true, ciclo_id: true },
    });

    if (!usuarioExistente) {
      throw new NotFoundException('El usuario a actualizar no existe o fue desactivado.');
    }

    if (updateUsuarioDto.email_institucional) {
      updateUsuarioDto.email_institucional = updateUsuarioDto.email_institucional.toLowerCase().trim();
    }

    if (updateUsuarioDto.ciclo_id) {
      const ciclo = await this.ciclosRepository.findOne({
        where: { id: updateUsuarioDto.ciclo_id, fecha_desactivacion: IsNull() },
        select: { id: true, carrera_id: true },
      });

      if (!ciclo) {
        throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
      }

      const carreraIdAValidar = updateUsuarioDto.carrera_id ?? usuarioExistente.carrera_id;
      if (carreraIdAValidar && ciclo.carrera_id !== carreraIdAValidar) {
        throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
      }
    }

    if (updateUsuarioDto.carrera_id && usuarioExistente.ciclo_id) {
      const cicloActual = await this.ciclosRepository.findOne({
        where: { id: usuarioExistente.ciclo_id, fecha_desactivacion: IsNull() },
        select: { id: true, carrera_id: true },
      });

      if (cicloActual && cicloActual.carrera_id !== updateUsuarioDto.carrera_id) {
        throw new BadRequestException('No es posible cambiar la carrera sin actualizar primero el ciclo asociado.');
      }
    }

    const datosActualizados: Partial<Usuario> = { ...updateUsuarioDto };

    const resultado = await this.usuariosRepository.update(id, datosActualizados);

    if (resultado.affected === 0) {
      throw new NotFoundException('El usuario a actualizar no existe o fue desactivado.');
    }

    return this.findOne(id);
  }

  // Busca el periodo de matrícula actualmente activo. Si no hay ninguno, no se puede completar perfil.
  private async obtenerPeriodoActivo(): Promise<PeriodoMatricula> {
    const periodo = await this.periodosRepository.findOne({
      where: { activo: true, fecha_desactivacion: IsNull() },
      order: { fecha_inicio: 'DESC' },
    });

    if (!periodo) {
      throw new BadRequestException(
        'No hay un periodo de matrícula activo en este momento. Comuníquese con Bienestar Estudiantil.',
      );
    }

    return periodo;
  }

  // Indica si el usuario ya llenó su perfil para el periodo activo, y devuelve ese periodo.
  async obtenerEstadoPerfil(usuarioId: string) {
    const periodoActivo = await this.obtenerPeriodoActivo();

    const perfilPeriodo = await this.perfilPeriodoRepository.findOne({
      where: { usuario_id: usuarioId, periodo_id: periodoActivo.id },
    });

    return {
      periodo: periodoActivo,
      perfil_completo: !!perfilPeriodo,
      perfil: perfilPeriodo,
    };
  }

  async completarPerfilEstudiante(usuarioId: string, rol: string, dto: CompletarPerfilDto) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true, cedula: true, carrera_id: true, ciclo_id: true },
    });
    if (!usuario) throw new NotFoundException('El usuario no existe o fue desactivado.');

    // El perfil siempre se guarda contra el periodo de matrícula activo.
    const periodoActivo = await this.obtenerPeriodoActivo();

    // La fecha de nacimiento llega como "DD/MM/AAAA" y se guarda como Date real.
    const fechaNacimiento = parseFechaNacimiento(dto.fecha_nacimiento);
    if (!fechaNacimiento) {
      throw new BadRequestException('La fecha de nacimiento ingresada no es válida.');
    }

    // ---------- 1. Datos de identidad del Usuario (cédula, nombres, correos, carrera/ciclo actual) ----------

    const datosUsuario: Partial<Usuario> = { cedula: dto.cedula };

    if (dto.primer_nombre) datosUsuario.primer_nombre = dto.primer_nombre;
    if (dto.segundo_nombre) datosUsuario.segundo_nombre = dto.segundo_nombre;
    if (dto.primer_apellido) datosUsuario.primer_apellido = dto.primer_apellido;
    if (dto.segundo_apellido) datosUsuario.segundo_apellido = dto.segundo_apellido;

    if (dto.email_institucional) {
      const emailInstitucional = dto.email_institucional.toLowerCase().trim();
      const enUso = await this.usuariosRepository.findOne({
        where: { email_institucional: emailInstitucional },
        select: { id: true },
      });
      if (enUso && enUso.id !== usuarioId) {
        throw new BadRequestException('El correo institucional ingresado ya está registrado por otro usuario.');
      }
      datosUsuario.email_institucional = emailInstitucional;
    }

    if (dto.email_personal) {
      const emailPersonal = dto.email_personal.toLowerCase().trim();
      const enUso = await this.usuariosRepository.findOne({
        where: { email_personal: emailPersonal },
        select: { id: true },
      });
      if (enUso && enUso.id !== usuarioId) {
        throw new BadRequestException('El correo personal ingresado ya está registrado por otro usuario.');
      }
      datosUsuario.email_personal = emailPersonal;
    }


    if (rol === 'ESTUDIANTE' || rol === 'INVITADO') {
  if (!dto.carrera_id || !dto.ciclo_id) {
    throw new BadRequestException('La carrera y el ciclo son obligatorios.');
  }
  const ciclo = await this.ciclosRepository.findOne({
    where: { id: dto.ciclo_id, fecha_desactivacion: IsNull() },
    select: { id: true, carrera_id: true },
  });
  if (!ciclo) {
    throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
  }
  if (ciclo.carrera_id !== dto.carrera_id) {
    throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
  }
  datosUsuario.carrera_id = dto.carrera_id;
  datosUsuario.ciclo_id = dto.ciclo_id;
}


    const cedulaEnUso = await this.usuariosRepository.findOne({
      where: { cedula: dto.cedula },
      select: { id: true },
    });
    if (cedulaEnUso && cedulaEnUso.id !== usuarioId) {
      throw new BadRequestException('La cédula ingresada ya está registrada por otro usuario.');
    }

    await this.usuariosRepository.update(usuarioId, datosUsuario);

    // ---------- 2. Datos personales del periodo activo (se piden cada nuevo periodo) ----------

    const datosPerfilPeriodo = {
      usuario_id: usuarioId,
      periodo_id: periodoActivo.id,
      numero_celular: dto.numero_celular,
      sexo: dto.sexo,
      estado_civil: dto.estado_civil,
      tiene_hijos: dto.tiene_hijos,
      etnia: dto.etnia,
      idioma: dto.idioma,
      lugar_nacimiento: dto.lugar_nacimiento,
      fecha_nacimiento: fechaNacimiento,
      rango_edad: dto.rango_edad,
      nacionalidad: dto.nacionalidad,
      // Solo se guarda si el sexo es Mujer; para Hombre queda en null aunque llegue en el body.
      esta_embarazada: dto.sexo === SexoEnum.MUJER ? (dto.esta_embarazada ?? false) : null,
      tiene_discapacidad: dto.tiene_discapacidad,
      // La subpregunta solo se guarda si tiene_discapacidad es true.
      tipo_discapacidad: dto.tiene_discapacidad ? (dto.tipo_discapacidad ?? null) : null,
      zona_residencia: dto.zona_residencia,
    };

    const perfilPeriodoExistente = await this.perfilPeriodoRepository.findOne({
      where: { usuario_id: usuarioId, periodo_id: periodoActivo.id },
      select: { id: true },
    });

    if (perfilPeriodoExistente) {
      await this.perfilPeriodoRepository.update(perfilPeriodoExistente.id, datosPerfilPeriodo);
    } else {
      const nuevoPerfilPeriodo = this.perfilPeriodoRepository.create(datosPerfilPeriodo);
      await this.perfilPeriodoRepository.save(nuevoPerfilPeriodo);
    }

    const perfilPeriodoGuardado = await this.perfilPeriodoRepository.findOne({
      where: { usuario_id: usuarioId, periodo_id: periodoActivo.id },
    });

    const usuarioActualizado = await this.findOne(usuarioId);

    return {
      usuario: usuarioActualizado,
      periodo: periodoActivo,
      perfil_periodo: perfilPeriodoGuardado,
    };
  }

  async actualizarFoto(usuarioId: string, archivo: Express.Multer.File) {
    // 1. Obtener el usuario actual para verificar si ya tiene una foto
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true, foto_url: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario no existe o fue desactivado.');
    }

    // 2. Si el usuario ya tiene una foto alojada en Supabase, la eliminamos primero
    if (usuario.foto_url && usuario.foto_url.includes('supabase.co')) {
      // Extraemos el nombre del archivo exacto desde la URL pública
      const urlParts = usuario.foto_url.split('/');
      const nombreArchivoAnterior = urlParts[urlParts.length - 1];

      if (nombreArchivoAnterior) {
        const { error: deleteError } = await this.supabase.storage
          .from('fotos_perfil')
          .remove([nombreArchivoAnterior]);

        if (deleteError) {
          console.warn(`No se pudo eliminar la foto anterior: ${deleteError.message}`);
        }
      }
    }

    // 3. Subir la nueva foto (Mantenemos tu lógica de Date.now() para evitar problemas de caché en el navegador)
    const nombreUnico = `perfil-${usuarioId}-${Date.now()}.webp`;

    const { error: uploadError } = await this.supabase.storage
      .from('fotos_perfil')
      .upload(nombreUnico, archivo.buffer, {
        contentType: archivo.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("ERROR REAL DE SUPABASE:", uploadError);
      throw new InternalServerErrorException(`Error al subir la nueva foto: ${uploadError.message}`);
    }

    // 4. Obtener la URL pública y guardar en la base de datos
    const { data } = this.supabase.storage.from('fotos_perfil').getPublicUrl(nombreUnico);

    await this.usuariosRepository.update(usuarioId, {
      foto_url: data.publicUrl,
      foto_personalizada: true,
    });

    return this.findOne(usuarioId);
  }

  async remove(id: string) {
    const resultado = await this.usuariosRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('El usuario a desactivar no existe.');
    }

    return { message: 'Usuario desactivado con éxito.' };
  }
}