import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Ciclo } from '../ciclos/entities/ciclo.entity';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';

@Injectable()
export class UsuariosService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
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
      relations: { rol: true, ciclo: true },
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

  async completarPerfilEstudiante(usuarioId: string, rol: string, dto: CompletarPerfilDto) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true, cedula: true, carrera_id: true, ciclo_id: true },
    });
    if (!usuario) throw new NotFoundException('El usuario no existe o fue desactivado.');

    const datosActualizar: Partial<Usuario> = { cedula: dto.cedula };

    // Solo el Estudiante requiere carrera y ciclo; el Invitado no.
    if (rol === 'ESTUDIANTE') {
      if (!dto.carrera_id || !dto.ciclo_id) {
        throw new BadRequestException('La carrera y el ciclo son obligatorios para estudiantes.');
      }
      const ciclo = await this.ciclosRepository.findOne({
        where: { id: dto.ciclo_id, fecha_desactivacion: IsNull() },
        select: { id: true, carrera_id: true },
      });
      if (!ciclo) throw new NotFoundException('El ciclo seleccionado no existe o está inactivo.');
      if (ciclo.carrera_id !== dto.carrera_id) {
        throw new BadRequestException('El ciclo seleccionado no pertenece a la carrera indicada.');
      }
      datosActualizar.carrera_id = dto.carrera_id;
      datosActualizar.ciclo_id = dto.ciclo_id;
    }

    const cedulaEnUso = await this.usuariosRepository.findOne({
      where: { cedula: dto.cedula },
      select: { id: true },
    });
    if (cedulaEnUso && cedulaEnUso.id !== usuarioId) {
      throw new BadRequestException('La cédula ingresada ya está registrada por otro usuario.');
    }

    await this.usuariosRepository.update(usuarioId, datosActualizar);
    return this.findOne(usuarioId);
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
          // Dependiendo de tu lógica, puedes lanzar error o simplemente continuar
        }
      }
    }

    // 3. Subir la nueva foto (Mantenemos tu lógica de Date.now() para evitar problemas de caché en el navegador)
    // Nota: Asegúrate de que el archivo realmente sea webp, de lo contrario podrías querer extraer la extensión dinámica.
    const nombreUnico = `perfil-${usuarioId}-${Date.now()}.webp`;

    const { error: uploadError } = await this.supabase.storage
      .from('fotos_perfil')
      .upload(nombreUnico, archivo.buffer, {
        contentType: archivo.mimetype,
        upsert: false
      });

    if (uploadError) {
      // Esto imprimirá en la terminal de NestJS el motivo exacto del bloqueo
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