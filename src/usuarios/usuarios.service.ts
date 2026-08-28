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
import { EtniaEnum, SexoEnum } from './enums/perfil-usuario.enum';
import { parseFechaNacimiento } from '../common/is-fecha-nacimiento.validator';
import { PeriodoMatricula } from '../periodos-matricula/entities/periodos-matricula.entity';
import { PerfilUsuarioPeriodo } from './entities/perfil-usuario-periodo.entity';

@Injectable()
export class UsuariosService {
  private readonly supabase: SupabaseClient;

  constructor(
    @InjectRepository(Usuario) private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Ciclo) private readonly ciclosRepository: Repository<Ciclo>,
    @InjectRepository(CicloCarrera) private readonly ciclosCarrerasRepository: Repository<CicloCarrera>,
    @InjectRepository(PeriodoMatricula) private readonly periodosRepository: Repository<PeriodoMatricula>,
    @InjectRepository(PerfilUsuarioPeriodo) private readonly perfilPeriodoRepository: Repository<PerfilUsuarioPeriodo>,
  ) {
    this.supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_KEY as string);
  }

  private async cicloPerteneceACarrera(cicloId: string, carreraId: string): Promise<boolean> {
    const vinculo = await this.ciclosCarrerasRepository.findOne({ where: { ciclo_id: cicloId, carrera_id: carreraId }, select: { id: true } });
    return !!vinculo;
  }

  async create(createUsuarioDto: CreateUsuarioDto) {
    const emailSanitizado = createUsuarioDto.email_institucional.toLowerCase().trim();
    const existe = await this.usuariosRepository.findOne({ where: { email_institucional: emailSanitizado }, select: { id: true } });
    if (existe) throw new BadRequestException('Correo registrado.');
    if (createUsuarioDto.cedula) {
      const cedulaExiste = await this.usuariosRepository.findOne({ where: { cedula: createUsuarioDto.cedula }, select: { id: true } });
      if (cedulaExiste) throw new BadRequestException('Cédula registrada.');
    }
    const nuevoUsuario = this.usuariosRepository.create({ ...createUsuarioDto, email_institucional: emailSanitizado });
    return this.usuariosRepository.save(nuevoUsuario);
  }

  findAll(skip: number = 0, take: number = 1000) {
    return this.usuariosRepository.find({
      skip: Math.max(Number(skip) || 0, 0), take: Math.min(Math.max(Number(take) || 1000, 1), 5000),
      select: { id: true, email_institucional: true, primer_nombre: true, primer_apellido: true, segundo_nombre: true, segundo_apellido: true, cedula: true, rol_id: true, carrera_id: true, ciclo_id: true, foto_url: true, fecha_desactivacion: true },
      relations: { rol: true, ciclo: true, carrera: true, coordinaciones: { carrera: true } }, order: { primer_nombre: 'ASC' }
    });
  }

  async findOne(id: string) {
    const usuario = await this.usuariosRepository.findOne({ where: { id, fecha_desactivacion: IsNull() }, relations: { rol: true, ciclo: true, carrera: true } });
    if (!usuario) throw new NotFoundException('Usuario no existe.');

    const periodoActivo = await this.periodosRepository.findOne({ where: { activo: true, fecha_desactivacion: IsNull() }, order: { fecha_inicio: 'DESC' } });
    let perfilPeriodo: PerfilUsuarioPeriodo | null = null;
    if (periodoActivo) perfilPeriodo = await this.perfilPeriodoRepository.findOne({ where: { usuario_id: id, periodo_id: periodoActivo.id } });

    // ✅ MAGIA DE RECUPERACIÓN: Si no tiene ficha en el periodo actual, buscamos la última que haya llenado en semestres anteriores.
    if (!perfilPeriodo) {
      perfilPeriodo = await this.perfilPeriodoRepository.findOne({ 
        where: { usuario_id: id }, 
        order: { created_at: 'DESC' } 
      });
    }

    const resultado: any = { ...usuario };
    if (perfilPeriodo) {
      resultado.sexo = perfilPeriodo.sexo;
      resultado.esta_embarazada = perfilPeriodo.esta_embarazada;
      resultado.genero = perfilPeriodo.genero;
      resultado.estado_civil = perfilPeriodo.estado_civil;
      resultado.tiene_hijos = perfilPeriodo.tiene_hijos;
      resultado.hijos_menores_5_anios = perfilPeriodo.hijos_menores_5_anios;
      resultado.etnia = perfilPeriodo.etnia;
      resultado.numero_celular = perfilPeriodo.numero_celular;
      resultado.pueblo_nacionalidad = perfilPeriodo.pueblo_nacionalidad;
      resultado.etnia_otra = perfilPeriodo.etnia_otra;
      resultado.idioma = perfilPeriodo.idioma;
      resultado.fecha_nacimiento = perfilPeriodo.fecha_nacimiento;
      resultado.nacionalidad_id = perfilPeriodo.nacionalidad_id;
      resultado.pais_nacimiento_id = perfilPeriodo.pais_nacimiento_id;
      resultado.provincia_nacimiento_id = perfilPeriodo.provincia_nacimiento_id;
      resultado.canton_nacimiento_id = perfilPeriodo.canton_nacimiento_id;
    }
    return resultado;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto) {
    const usuarioExistente = await this.usuariosRepository.findOne({ where: { id, fecha_desactivacion: IsNull() }, select: { id: true, carrera_id: true, ciclo_id: true } });
    if (!usuarioExistente) throw new NotFoundException('Usuario no existe.');
    if (updateUsuarioDto.email_institucional) updateUsuarioDto.email_institucional = updateUsuarioDto.email_institucional.toLowerCase().trim();
    if (updateUsuarioDto.carrera_id && usuarioExistente.ciclo_id) {
      if (!(await this.cicloPerteneceACarrera(usuarioExistente.ciclo_id, updateUsuarioDto.carrera_id))) throw new BadRequestException('Actualiza ciclo primero.');
    }
    await this.usuariosRepository.update(id, { ...updateUsuarioDto });
    return this.findOne(id);
  }

  private async obtenerPeriodoActivo(): Promise<PeriodoMatricula> {
    const periodo = await this.periodosRepository.findOne({ where: { activo: true, fecha_desactivacion: IsNull() }, order: { fecha_inicio: 'DESC' } });
    if (!periodo) throw new BadRequestException('No hay periodo activo.');
    return periodo;
  }

  async obtenerEstadoPerfil(usuarioId: string) {
    const periodoActivo = await this.obtenerPeriodoActivo();
    let perfilPeriodo = await this.perfilPeriodoRepository.findOne({ where: { usuario_id: usuarioId, periodo_id: periodoActivo.id } });
    
    // Solo marca "Completo = true" si llenó en ESTE periodo.
    const perfilCompletoActual = !!perfilPeriodo; 

    // Si no ha llenado en este periodo, buscamos el histórico para pre-cargar los datos al Front
    if (!perfilPeriodo) {
      perfilPeriodo = await this.perfilPeriodoRepository.findOne({ where: { usuario_id: usuarioId }, order: { created_at: 'DESC' } });
    }

    return { periodo: periodoActivo, perfil_completo: perfilCompletoActual, perfil: perfilPeriodo };
  }

  private async validarCarreraYCicloEstudiante(carreraId?: string, cicloId?: string): Promise<void> {
    if (!carreraId || !cicloId) throw new BadRequestException('Carrera y ciclo obligatorios.');
    const ciclo = await this.ciclosRepository.findOne({ where: { id: cicloId, fecha_desactivacion: IsNull() }, select: { id: true } });
    if (!ciclo) throw new NotFoundException('Ciclo no existe.');
    if (!(await this.cicloPerteneceACarrera(ciclo.id, carreraId))) throw new BadRequestException('Ciclo no pertenece a carrera.');
  }

  async completarPerfilEstudiante(usuarioId: string, rol: string, dto: CompletarPerfilDto) {
    const usuario = await this.usuariosRepository.findOne({ where: { id: usuarioId, fecha_desactivacion: IsNull() }, select: { id: true } });
    if (!usuario) throw new NotFoundException('Usuario no existe.');

    const periodoActivo = await this.obtenerPeriodoActivo();
    const fechaNacimiento = parseFechaNacimiento(dto.fecha_nacimiento);
    if (!fechaNacimiento) throw new BadRequestException('Fecha no válida.');

    const datosUsuario: Partial<Usuario> = { cedula: dto.cedula, primer_nombre: dto.primer_nombre, segundo_nombre: dto.segundo_nombre, primer_apellido: dto.primer_apellido, segundo_apellido: dto.segundo_apellido };
    if (dto.email_institucional) {
      const emailInst = dto.email_institucional.toLowerCase().trim();
      const enUso = await this.usuariosRepository.findOne({ where: { email_institucional: emailInst }, select: { id: true } });
      if (enUso && enUso.id !== usuarioId) throw new BadRequestException('Correo ya registrado.');
      datosUsuario.email_institucional = emailInst;
    }

    if (rol === 'ESTUDIANTE' || rol === 'INVITADO') {
      await this.validarCarreraYCicloEstudiante(dto.carrera_id, dto.ciclo_id);
      datosUsuario.carrera_id = dto.carrera_id;
      datosUsuario.ciclo_id = dto.ciclo_id;
    }

    const cedulaEnUso = await this.usuariosRepository.findOne({ where: { cedula: dto.cedula }, select: { id: true } });
    if (cedulaEnUso && cedulaEnUso.id !== usuarioId) throw new BadRequestException('Cédula ya registrada.');

    await this.usuariosRepository.update(usuarioId, datosUsuario);

    const datosPerfilPeriodo = {
      usuario_id: usuarioId,
      periodo_id: periodoActivo.id,
      sexo: dto.sexo,
      esta_embarazada: dto.sexo === SexoEnum.MUJER ? (dto.esta_embarazada ?? false) : null,
      genero: dto.genero,
      numero_celular: dto.numero_celular,
      estado_civil: dto.estado_civil,
      tiene_hijos: dto.tiene_hijos,
      hijos_menores_5_anios: dto.tiene_hijos ? (dto.hijos_menores_5_anios ?? 0) : null,
      etnia: dto.etnia,
      pueblo_nacionalidad: dto.etnia === EtniaEnum.INDIGENA ? dto.pueblo_nacionalidad : null,
      etnia_otra: dto.etnia === EtniaEnum.OTRO ? dto.etnia_otra : null,
      idioma: dto.idioma,
      fecha_nacimiento: fechaNacimiento,
      nacionalidad_id: dto.nacionalidad_id,
      pais_nacimiento_id: dto.pais_nacimiento_id,
      provincia_nacimiento_id: dto.provincia_nacimiento_id ?? null,
      canton_nacimiento_id: dto.canton_nacimiento_id ?? null,
    };

    const perfilPeriodoExistente = await this.perfilPeriodoRepository.findOne({ where: { usuario_id: usuarioId, periodo_id: periodoActivo.id }, select: { id: true } });
    if (perfilPeriodoExistente) await this.perfilPeriodoRepository.update(perfilPeriodoExistente.id, datosPerfilPeriodo);
    else await this.perfilPeriodoRepository.save(this.perfilPeriodoRepository.create(datosPerfilPeriodo));

    return { usuario: await this.findOne(usuarioId), periodo: periodoActivo, perfil_periodo: await this.perfilPeriodoRepository.findOne({ where: { usuario_id: usuarioId, periodo_id: periodoActivo.id } }) };
  }

  async actualizarFoto(usuarioId: string, archivo: Express.Multer.File) {
    const usuario = await this.usuariosRepository.findOne({ where: { id: usuarioId, fecha_desactivacion: IsNull() }, select: { id: true, foto_url: true } });
    if (!usuario) throw new NotFoundException('Usuario no existe.');
    if (usuario.foto_url?.includes('supabase.co')) {
      const nombreArchivoAnterior = usuario.foto_url.split('/').at(-1);
      if (nombreArchivoAnterior) await this.supabase.storage.from('fotos_perfil').remove([nombreArchivoAnterior]);
    }
    const nombreUnico = `perfil-${usuarioId}-${Date.now()}.webp`;
    const { error: uploadError } = await this.supabase.storage.from('fotos_perfil').upload(nombreUnico, archivo.buffer, { contentType: archivo.mimetype, upsert: false });
    if (uploadError) throw new InternalServerErrorException(`Error foto: ${uploadError.message}`);
    const { data } = this.supabase.storage.from('fotos_perfil').getPublicUrl(nombreUnico);
    await this.usuariosRepository.update(usuarioId, { foto_url: data.publicUrl, foto_personalizada: true });
    return this.findOne(usuarioId);
  }

  async remove(id: string) {
    await this.usuariosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Desactivado con éxito.' };
  }
}