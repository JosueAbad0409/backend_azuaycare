import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PerfilCoordinador } from './entities/perfil-coordinador.entity';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';
import { AyudaEstudianteResponseDto, PerfilAyudaDto } from './dto/ayuda-estudiante-response.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CoordinadoresCarrera } from '../coordinadores-carreras/entities/coordinadores-carrera.entity';

@Injectable()
export class PerfilCoordinadorService {
  constructor(
    @InjectRepository(PerfilCoordinador)
    private readonly perfilRepository: Repository<PerfilCoordinador>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(CoordinadoresCarrera)
    private readonly coordinadoresCarreraRepository: Repository<CoordinadoresCarrera>,
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
    await this.perfilRepository.update({ usuario_id: usuarioId }, datosActualizados);
    return this.findByUsuario(usuarioId);
  }

  async getAyudaParaEstudiante(usuarioId: string): Promise<AyudaEstudianteResponseDto> {
    const bienestarUsuario = await this.usuarioRepository.findOne({
      where: { rol: { nombre: 'COORDINADOR_BIENESTAR' } },
      relations: { rol: true },
    });

    let bienestarDto: PerfilAyudaDto | null = null;
    if (bienestarUsuario) {
      const perfilBienestar = await this.perfilRepository.findOne({
        where: { usuario_id: bienestarUsuario.id },
        relations: { usuario: true },
      });
      bienestarDto = perfilBienestar ? this.mapAPerfilAyudaDto(perfilBienestar) : null;
    }

    const usuarioActual = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });

    if (!usuarioActual?.carrera_id) {
      return { bienestarEstudiantil: bienestarDto, coordinadoresCarrera: [] };
    }

    const asignaciones = await this.coordinadoresCarreraRepository.find({
      where: { carrera_id: usuarioActual.carrera_id },
    });

    if (asignaciones.length === 0) {
      return { bienestarEstudiantil: bienestarDto, coordinadoresCarrera: [] };
    }

    const usuarioIds = asignaciones.map((a) => a.usuario_id);
    const perfiles = await this.perfilRepository.find({
      where: { usuario_id: In(usuarioIds) },
      relations: { usuario: true },
    });

    return {
      bienestarEstudiantil: bienestarDto,
      coordinadoresCarrera: perfiles.map((p) => this.mapAPerfilAyudaDto(p)),
    };
  }

  private mapAPerfilAyudaDto(perfil: PerfilCoordinador): PerfilAyudaDto {
    const usuario = perfil.usuario;
    const nombreCompleto = [usuario.primer_nombre, usuario.primer_apellido]
      .filter(Boolean)
      .join(' ');

    return {
      id: perfil.id,
      nombreCompleto,
      cargo: perfil.titulo_profesional,
      mensajeAyuda: perfil.mensaje_ayuda_estudiantes,
      correo: perfil.correo_contacto,
      telefono: perfil.telefono_contacto,
      horarioAtencion: perfil.horario_atencion,
      ubicacion: perfil.ubicacion_oficina,
      fotoUrl: usuario.foto_url,
    };
  }
}