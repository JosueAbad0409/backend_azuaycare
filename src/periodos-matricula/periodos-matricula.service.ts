import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { PeriodoMatricula } from './entities/periodos-matricula.entity';
import { CreatePeriodoMatriculaDto } from './dto/create-periodos-matricula.dto';
import { UpdatePeriodoMatriculaDto } from './dto/update-periodos-matricula.dto';
import { FormulariosService } from 'src/formularios/formularios.service';

@Injectable()
export class PeriodosMatriculaService {
  constructor(
    @InjectRepository(PeriodoMatricula)
    private readonly periodosRepository: Repository<PeriodoMatricula>,
    @Inject(forwardRef(() => FormulariosService))
    private readonly formulariosService: FormulariosService,
  ) { }

  // =========================
  // VALIDACIONES PRIVADAS
  // =========================

  private validarFechasBasicas(fechaInicio: Date | string, fechaFin: Date | string) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      throw new BadRequestException('Las fechas proporcionadas no son válidas.');
    }

    if (inicio >= fin) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin.',
      );
    }
  }

  private validarNoFechasPasadas(fechaInicio: Date | string) {
    const inicio = new Date(fechaInicio);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (inicio < hoy) {
      throw new BadRequestException(
        'No se puede crear un periodo con fecha de inicio en el pasado.',
      );
    }
  }

  private async validarNoSolapamiento(
    fechaInicio: Date | string,
    fechaFin: Date | string,
    excluirId?: string,
  ) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    const query = this.periodosRepository
      .createQueryBuilder('p')
      .where('p.fecha_desactivacion IS NULL')
      .andWhere(
        `(
          (p.fecha_inicio <= :inicio AND p.fecha_fin >= :inicio) OR
          (p.fecha_inicio <= :fin AND p.fecha_fin >= :fin) OR
          (p.fecha_inicio >= :inicio AND p.fecha_fin <= :fin)
        )`,
        { inicio, fin },
      );

    if (excluirId) {
      query.andWhere('p.id != :excluirId', { excluirId });
    }

    const solapado = await query.getOne();

    if (solapado) {
      throw new BadRequestException(
        `Las fechas seleccionadas ya se encuentran dentro del período "${solapado.nombre}" (${solapado.fecha_inicio} → ${solapado.fecha_fin}). Verifique las fechas e intente nuevamente.`
      );
    }
  }

  private async validarNombreUnico(nombre: string, excluirId?: string) {
    const nombreSanitizado = nombre.toUpperCase().trim();

    const existe = await this.periodosRepository.findOne({
      where: {
        nombre: nombreSanitizado,
        fecha_desactivacion: IsNull(),
        ...(excluirId ? { id: Not(excluirId) } : {}),
      },
    });

    if (existe) {
      throw new BadRequestException(
        `Ya existe un periodo con el nombre "${nombreSanitizado}".`,
      );
    }

    return nombreSanitizado;
  }

  // =========================
  // MÉTODOS PÚBLICOS
  // =========================

  async create(createDto: CreatePeriodoMatriculaDto, usuarioId?: string) {
    // 1. Validaciones de fechas
    this.validarFechasBasicas(createDto.fecha_inicio, createDto.fecha_fin);
    this.validarNoFechasPasadas(createDto.fecha_inicio);
    await this.validarNoSolapamiento(createDto.fecha_inicio, createDto.fecha_fin);

    // 2. Nombre único y sanitizado
    const nombreSanitizado = await this.validarNombreUnico(createDto.nombre);

    // 3. Si se marca como activo → desactivar los demás
    if (createDto.activo) {
      await this.periodosRepository.update(
        { activo: true, fecha_desactivacion: IsNull() },
        { activo: false },
      );
    }

    // 4. Crear
    const nuevoPeriodo = this.periodosRepository.create({
      ...createDto,
      nombre: nombreSanitizado,
    });

    const periodoGuardado = await this.periodosRepository.save(nuevoPeriodo);

    // 5. Clonar formulario si se solicitó
    if (createDto.clonar_formulario_origen_id && usuarioId) {
      await this.formulariosService.clonarAFormularioBorrador(
        createDto.clonar_formulario_origen_id,
        periodoGuardado.id,
        usuarioId,
      );
    }

    return this.findOne(periodoGuardado.id);
  }

  async activarNuevoPeriodo(createDto: CreatePeriodoMatriculaDto, usuarioId: string) {
    createDto.activo = true;
    return this.create(createDto, usuarioId);
  }

  async cerrarYBloquear(id: string) {
    const periodo = await this.findOne(id);

    if (periodo.bloqueado) {
      throw new BadRequestException('El periodo de matrícula ya se encuentra bloqueado.');
    }

    await this.periodosRepository.update(id, {
      bloqueado: true,
      fecha_bloqueo: new Date(),
      activo: false,
    });

    return this.findOne(id);
  }

  findAll(skip: number = 0, take: number = 10) {
    const limiteReal = Math.min(Math.max(Number(take) || 10, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);

    return this.periodosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const periodo = await this.periodosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!periodo) {
      throw new NotFoundException('El periodo solicitado no existe o está inactivo.');
    }

    return periodo;
  }

  async update(id: string, updateDto: UpdatePeriodoMatriculaDto) {
    const periodo = await this.findOne(id);

    // No permitir modificar un periodo bloqueado
    if (periodo.bloqueado) {
      throw new BadRequestException(
        'No se puede modificar un periodo que ya está bloqueado.',
      );
    }

    const datosActualizados: Partial<PeriodoMatricula> = { ...updateDto };

    // Validar fechas si se están actualizando
    const nuevaFechaInicio = updateDto.fecha_inicio ?? periodo.fecha_inicio;
    const nuevaFechaFin = updateDto.fecha_fin ?? periodo.fecha_fin;

    if (updateDto.fecha_inicio || updateDto.fecha_fin) {
      this.validarFechasBasicas(nuevaFechaInicio, nuevaFechaFin);
      await this.validarNoSolapamiento(nuevaFechaInicio, nuevaFechaFin, id);
    }

    // Validar nombre único si se está cambiando
    if (updateDto.nombre) {
      datosActualizados.nombre = await this.validarNombreUnico(updateDto.nombre, id);
    }

    // Si se activa este periodo → desactivar los demás
    if (updateDto.activo === true) {
      await this.periodosRepository.update(
        { id: Not(id), activo: true, fecha_desactivacion: IsNull() },
        { activo: false },
      );
    }

    await this.periodosRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    const periodo = await this.findOne(id);

    if (periodo.activo) {
      throw new BadRequestException(
        'No se puede eliminar un periodo de matrícula que está activo.',
      );
    }

    if (periodo.bloqueado) {
      throw new BadRequestException(
        'No se puede eliminar un periodo que ya está bloqueado.',
      );
    }

    await this.periodosRepository.update(id, {
      fecha_desactivacion: new Date(),
      activo: false,
    });

    return { message: 'Periodo de matrícula desactivado con éxito.' };
  }
}