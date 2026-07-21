import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PerfilCoordinador } from './entities/perfil-coordinador.entity';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';

@Injectable()
export class PerfilCoordinadorService {
  constructor(
    @InjectRepository(PerfilCoordinador)
    private readonly perfilRepository: Repository<PerfilCoordinador>,
  ) {}

  async create(createDto: CreatePerfilCoordinadorDto) {
    const existe = await this.perfilRepository.findOne({
      where: { usuario_id: createDto.usuario_id },
    });

    if (existe) {
      throw new BadRequestException('Este coordinador ya tiene un perfil creado.');
    }

    const nuevoPerfil = this.perfilRepository.create(createDto);
    return this.perfilRepository.save(nuevoPerfil);
  }

  async findByUsuario(usuarioId: string) {
    const perfil = await this.perfilRepository.findOne({
      where: { usuario_id: usuarioId },
    });

    if (!perfil) {
      throw new NotFoundException('El perfil de este coordinador no existe.');
    }

    return perfil;
  }

  async update(usuarioId: string, datosActualizados: Partial<PerfilCoordinador>) {
    await this.findByUsuario(usuarioId);
    
    // Actualizamos basándonos en el usuario_id, no en el id del perfil
    await this.perfilRepository.update({ usuario_id: usuarioId }, datosActualizados);
    return this.findByUsuario(usuarioId);
  }
}