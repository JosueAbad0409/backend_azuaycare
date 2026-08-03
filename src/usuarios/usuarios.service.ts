import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Ciclo } from '../ciclos/entities/ciclo.entity';
import { CompletarPerfilDto } from './dto/CompletarPerfilDto ';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Ciclo)
    private readonly ciclosRepository: Repository<Ciclo>,
  ) {}

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
      // Quitamos el filtro "where: { fecha_desactivacion: IsNull() }" para que devuelva TODOS
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
        fecha_desactivacion: true, // <-- NUEVO: Para saber si está eliminado
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

  /**
   * Permite que el propio estudiante complete su registro (cédula, carrera y ciclo)
   * la primera vez que ingresa con sus credenciales de Google.
   * El id del usuario se obtiene del token JWT (no se recibe por parámetro del cliente),
   * de modo que un estudiante nunca pueda editar el perfil de otro usuario.
   */
  async completarPerfilEstudiante(usuarioId: string, dto: CompletarPerfilDto) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: usuarioId, fecha_desactivacion: IsNull() },
      select: { id: true, cedula: true, carrera_id: true, ciclo_id: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario no existe o fue desactivado.');
    }

    // Validamos que el ciclo exista, esté activo y pertenezca a la carrera indicada
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

    // Validamos que la cédula no esté siendo usada por otro usuario
    const cedulaEnUso = await this.usuariosRepository.findOne({
      where: { cedula: dto.cedula },
      select: { id: true },
    });

    if (cedulaEnUso && cedulaEnUso.id !== usuarioId) {
      throw new BadRequestException('La cédula ingresada ya está registrada por otro usuario.');
    }

    await this.usuariosRepository.update(usuarioId, {
      cedula: dto.cedula,
      carrera_id: dto.carrera_id,
      ciclo_id: dto.ciclo_id,
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