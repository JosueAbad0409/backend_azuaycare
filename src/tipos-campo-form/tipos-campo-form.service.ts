import { Injectable, NotFoundException, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Not } from 'typeorm';
import { TipoCampoForm } from './entities/tipos-campo-form.entity';
import { CreateTipoCampoFormDto } from './dto/create-tipos-campo-form.dto';
import { UpdateTipoCampoFormDto } from './dto/update-tipos-campo-form.dto';

@Injectable()
export class TiposCampoFormService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(TipoCampoForm)
    private readonly tiposRepository: Repository<TipoCampoForm>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedTiposCampo();
  }

  private async seedTiposCampo() {
    const tiposDefecto = [
      { nombre: 'TEXTO', descripcion: 'Campo de texto libre corto o largo' },
      { nombre: 'NUMERICO', descripcion: 'Campo para valores numéricos enteros o decimales' },
      { nombre: 'SELECCION_UNICA', descripcion: 'Opciones donde solo se puede elegir una respuesta' },
      { nombre: 'SELECCION_MULTIPLE', descripcion: 'Opciones donde se pueden elegir varias respuestas' },
      { nombre: 'MATRIZ', descripcion: 'Estructura de filas y columnas para respuestas complejas' },
    ];

    try {
      const nombres = tiposDefecto.map(t => t.nombre);
      const existentes = await this.tiposRepository.find({
        where: { nombre: In(nombres) },
        select: { nombre: true },
      });

      const nombresExistentes = new Set(existentes.map(e => e.nombre));
      const aCrear = tiposDefecto
        .filter(t => !nombresExistentes.has(t.nombre))
        .map(t => this.tiposRepository.create(t));

      if (aCrear.length > 0) {
        await this.tiposRepository.insert(aCrear);
        console.log(`[Seed] Tipos de campos inicializados con éxito.`);
      }
    } catch (error: any) { 
      console.error('[Seed Error] No se pudieron inicializar los tipos de campos:', error.message);
    }
  }

  async create(createDto: CreateTipoCampoFormDto) {
    const nombreSanitizado = createDto.nombre.toUpperCase().trim();

    const existe = await this.tiposRepository.findOne({
      where: { nombre: nombreSanitizado, fecha_desactivacion: IsNull() },
    });

    if (existe) {
      throw new BadRequestException('Ya existe un tipo de campo registrado con ese nombre.');
    }

    const nuevoTipo = this.tiposRepository.create({
      ...createDto,
      nombre: nombreSanitizado,
    });

    return this.tiposRepository.save(nuevoTipo);
  }

  findAll(skip: number=0, take: number=10) {
    return this.tiposRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const tipo = await this.tiposRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!tipo) {
      throw new NotFoundException('El tipo de campo solicitado no existe o está inactivo.');
    }

    return tipo;
  }

  async update(id: string, updateDto: UpdateTipoCampoFormDto) {
    await this.findOne(id);
    const datosActualizados: Partial<TipoCampoForm> = { ...updateDto };

    if (updateDto.nombre) {
      const nombreSanitizado = updateDto.nombre.toUpperCase().trim();
      const colision = await this.tiposRepository.findOne({
        where: { nombre: nombreSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });
      if (colision) throw new BadRequestException('El nuevo nombre ya existe en otro tipo de campo.');
      datosActualizados.nombre = nombreSanitizado;
    }

    await this.tiposRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tiposRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Tipo de campo desactivado con éxito.' };
  }
}