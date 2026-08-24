import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Ciclo } from '../ciclos/entities/ciclo.entity';
import { CicloCarrera } from '../ciclos/entities/ciclo-carrera.entity';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import { SexoEnum } from './enums/perfil-usuario.enum';
import { parseFechaNacimiento } from '../common/is-fecha-nacimiento.validator';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { PerfilUsuarioPeriodo } from './entities/perfil-usuario-periodo.entity';

@Injectable()
export class UsuariosService {
  private readonly supabase: SupabaseClient;

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
    @InjectRepository(CicloCarrera)
    private readonly ciclosCarrerasRepository: Repository<CicloCarrera>,
    @InjectRepository(PeriodoMatricula)
    private readonly periodosRepository: Repository<PeriodoMatricula>,
    @InjectRepository(PerfilUsuarioPeriodo)
    private readonly perfilPeriodoRepository: Repository<PerfilUsuarioPeriodo>,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  private async cicloPerteneceACarrera(cicloId: string, carreraId: string): Promise<boolean> {
    const vinculo = await this.ciclosCarrerasRepository.findOne({
      where: { ciclo_id: cicloId, carrera_id: carreraId },
      select: { id: true },
    });
    return !!vinculo;
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
        select: { id: true },
      });

      if (!ciclo) {
        throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
      }

      if (
        createUsuarioDto.carrera_id &&
        !(await this.cicloPerteneceACarrera(ciclo.id, createUsuarioDto.carrera_id))
      ) {
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
      relations: { rol: true, ciclo: true, carrera: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario solicitado no existe o fue desactivado.');
    }

    const periodoActivo = await this.periodosRepository.findOne({
      where: { activo: true, fecha_desactivacion: IsNull() },
      order: { fecha_inicio: 'DESC' },
    });

    let perfilPeriodo: PerfilUsuarioPeriodo | null = null;
    if (periodoActivo) {
      perfilPeriodo = await this.perfilPeriodoRepository.findOne({
        where: { usuario_id: id, periodo_id: periodoActivo.id },
      });
    }

    return {
      ...usuario,
      ...(perfilPeriodo ? {
        numero_celular: perfilPeriodo.numero_celular,
        sexo: perfilPeriodo.sexo,
        estado_civil: perfilPeriodo.estado_civil,
        tiene_hijos: perfilPeriodo.tiene_hijos,
        etnia: perfilPeriodo.etnia,
        idioma: perfilPeriodo.idioma,
        lugar_nacimiento: perfilPeriodo.lugar_nacimiento,
        fecha_nacimiento: perfilPeriodo.fecha_nacimiento,
        rango_edad: perfilPeriodo.rango_edad,
        nacionalidad: perfilPeriodo.nacionalidad,
        esta_embarazada: perfilPeriodo.esta_embarazada,
        tiene_discapacidad: perfilPeriodo.tiene_discapacidad,
        tipo_discapacidad: perfilPeriodo.tipo_discapacidad,
        zona_residencia: perfilPeriodo.zona_residencia,
      } : {}),
    };
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
        select: { id: true },
      });

      if (!ciclo) {
        throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
      }

      const carreraIdAValidar = updateUsuarioDto.carrera_id ?? usuarioExistente.carrera_id;
      if (carreraIdAValidar && !(await this.cicloPerteneceACarrera(ciclo.id, carreraIdAValidar))) {
        throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
      }
    }

    if (updateUsuarioDto.carrera_id && usuarioExistente.ciclo_id) {
      const perteneceALaNuevaCarrera = await this.cicloPerteneceACarrera(
        usuarioExistente.ciclo_id,
        updateUsuarioDto.carrera_id,
      );

      if (!perteneceALaNuevaCarrera) {
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

  // Helper para validar asignación de carrera y ciclo
  private async validarCarreraYCicloEstudiante(carreraId?: string, cicloId?: string): Promise<void> {
    if (!carreraId || !cicloId) {
      throw new BadRequestException('La carrera y el ciclo son obligatorios.');
    }
    const ciclo = await this.ciclosRepository.findOne({ 
      where: { id: cicloId, fecha_desactivacion: IsNull() }, 
      select: { id: true } 
    });
    if (!ciclo) {
      throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
    }
    if (!(await this.cicloPerteneceACarrera(ciclo.id, carreraId))) {
      throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
    }
  }

  // Helper para validar duplicidad de correos
  private async validarCorreosUnicos(usuarioId: string, dto: CompletarPerfilDto, datosUsuario: Partial<Usuario>): Promise<void> {
    if (dto.email_institucional) {
      const emailInst = dto.email_institucional.toLowerCase().trim();
      const enUso = await this.usuariosRepository.findOne({ where: { email_institucional: emailInst }, select: { id: true } });
      if (enUso && enUso.id !== usuarioId) throw new BadRequestException('El correo institucional ingresado ya está registrado por otro usuario.');
      datosUsuario.email_institucional = emailInst;
    }

    if (dto.email_personal) {
      const emailPers = dto.email_personal.toLowerCase().trim();
      const enUso = await this.usuariosRepository.findOne({ where: { email_personal: emailPers }, select: { id: true } });
      if (enUso && enUso.id !== usuarioId) throw new BadRequestException('El correo personal ingresado ya está registrado por otro usuario.');
      datosUsuario.email_personal = emailPers;
    }
  }

  // Función refactorizada: ahora tiene muy poca complejidad cognitiva
  private async actualizarIdentidadUsuario(usuarioId: string, rol: string, dto: CompletarPerfilDto): Promise<void> {
    const datosUsuario: Partial<Usuario> = { cedula: dto.cedula };

    if (dto.primer_nombre) datosUsuario.primer_nombre = dto.primer_nombre;
    if (dto.segundo_nombre) datosUsuario.segundo_nombre = dto.segundo_nombre;
    if (dto.primer_apellido) datosUsuario.primer_apellido = dto.primer_apellido;
    if (dto.segundo_apellido) datosUsuario.segundo_apellido = dto.segundo_apellido;

    await this.validarCorreosUnicos(usuarioId, dto, datosUsuario);

    if (rol === 'ESTUDIANTE' || rol === 'INVITADO') {
      await this.validarCarreraYCicloEstudiante(dto.carrera_id, dto.ciclo_id);
      datosUsuario.carrera_id = dto.carrera_id;
      datosUsuario.ciclo_id = dto.ciclo_id;
    }

    const cedulaEnUso = await this.usuariosRepository.findOne({ where: { cedula: dto.cedula }, select: { id: true } });
    if (cedulaEnUso && cedulaEnUso.id !== usuarioId) {
      throw new BadRequestException('La cédula ingresada ya está registrada por otro usuario.');
    }

    await this.usuariosRepository.update(usuarioId, datosUsuario);
  }

  private async guardarFichaDemografica(usuarioId: string, periodoId: string, dto: CompletarPerfilDto, fechaNacimiento: Date) {
    const datosPerfilPeriodo = {
      usuario_id: usuarioId,
      periodo_id: periodoId,
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
      esta_embarazada: dto.sexo === SexoEnum.MUJER ? (dto.esta_embarazada ?? false) : null,
      tiene_discapacidad: dto.tiene_discapacidad,
      tipo_discapacidad: dto.tiene_discapacidad ? (dto.tipo_discapacidad ?? null) : null,
      zona_residencia: dto.zona_residencia,
    };

    const perfilPeriodoExistente = await this.perfilPeriodoRepository.findOne({
      where: { usuario_id: usuarioId, periodo_id: periodoId },
      select: { id: true },
    });

    if (perfilPeriodoExistente) {
      await this.perfilPeriodoRepository.update(perfilPeriodoExistente.id, datosPerfilPeriodo);
    } else {
      const nuevoPerfilPeriodo = this.perfilPeriodoRepository.create(datosPerfilPeriodo);
      await this.perfilPeriodoRepository.save(nuevoPerfilPeriodo);
    }

    return this.perfilPeriodoRepository.findOne({ where: { usuario_id: usuarioId, periodo_id: periodoId } });
  }

  async completarPerfilEstudiante(usuarioId: string, rol: string, dto: CompletarPerfilDto) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true },
    });
    if (!usuario) throw new NotFoundException('El usuario no existe o fue desactivado.');

    const periodoActivo = await this.obtenerPeriodoActivo();

    const fechaNacimiento = parseFechaNacimiento(dto.fecha_nacimiento);
    if (!fechaNacimiento) {
      throw new BadRequestException('La fecha de nacimiento ingresada no es válida.');
    }

    await this.actualizarIdentidadUsuario(usuarioId, rol, dto);
    const perfilPeriodoGuardado = await this.guardarFichaDemografica(usuarioId, periodoActivo.id, dto, fechaNacimiento);
    const usuarioActualizado = await this.findOne(usuarioId);

    return {
      usuario: usuarioActualizado,
      periodo: periodoActivo,
      perfil_periodo: perfilPeriodoGuardado,
    };
  }

  async actualizarFoto(usuarioId: string, archivo: Express.Multer.File) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true, foto_url: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario no existe o fue desactivado.');
    }

    if (usuario.foto_url?.includes('supabase.co')) {
      const urlParts = usuario.foto_url.split('/');
      const nombreArchivoAnterior = urlParts.at(-1);

      if (nombreArchivoAnterior) {
        const { error: deleteError } = await this.supabase.storage
          .from('fotos_perfil')
          .remove([nombreArchivoAnterior]);

        if (deleteError) {
          console.warn(`No se pudo eliminar la foto anterior: ${deleteError.message}`);
        }
      }
    }

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