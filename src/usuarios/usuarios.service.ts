import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
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

    const nuevoUsuario = this.usuariosRepository.create({
      ...createUsuarioDto,
      email_institucional: emailSanitizado,
    });

    return this.usuariosRepository.save(nuevoUsuario);
  }

  findAll(skip: number=0, take: number=10) {
    return this.usuariosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
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
      },
      relations: { rol: true },
    });
  }

  async findOne(id: string) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { rol: true },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario solicitado no existe o fue desactivado.');
    }

    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto) {
    const datosActualizados: Partial<Usuario> = { ...updateUsuarioDto };

    if (updateUsuarioDto.email_institucional) {
      datosActualizados.email_institucional = updateUsuarioDto.email_institucional.toLowerCase().trim();
    }

    const resultado = await this.usuariosRepository.update(id, datosActualizados);

    if (resultado.affected === 0) {
      throw new NotFoundException('El usuario a actualizar no existe o fue desactivado.');
    }

    return this.findOne(id);
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