import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, ILike } from 'typeorm';
import { TipoFormulario } from './entities/tipo-formulario.entity';
import { CreateTipoFormularioDto } from './dto/create-tipo-formulario.dto';
import { UpdateTipoFormularioDto } from './dto/update-tipo-formulario.dto';
import { Formulario } from '../formularios/entities/formulario.entity';

@Injectable()
export class TiposFormularioService {
  constructor(
    @InjectRepository(TipoFormulario)
    private readonly tiposFormularioRepository: Repository<TipoFormulario>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  async create(createDto: CreateTipoFormularioDto) {
    const nombreSanitizado = createDto.nombre.trim();

    const existe = await this.tiposFormularioRepository.findOne({
      where: { nombre: ILike(nombreSanitizado), fecha_desactivacion: IsNull() },
    });
    if (existe) {
      throw new BadRequestException('Ya existe un tipo de formulario registrado con ese nombre.');
    }

    const nuevoTipo = this.tiposFormularioRepository.create({
      ...createDto,
      nombre: nombreSanitizado,
    });

    return this.tiposFormularioRepository.save(nuevoTipo);
  }

  findAll(skip: number = 0, take: number = 50) {
    const limiteReal = Math.min(Math.max(Number(take) || 50, 1), 100);
    const skipReal = Math.max(Number(skip) || 0, 0);
    return this.tiposFormularioRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const tipo = await this.tiposFormularioRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!tipo) {
      throw new NotFoundException('El tipo de formulario solicitado no existe o está inactivo.');
    }

    return tipo;
  }

  async update(id: string, updateDto: UpdateTipoFormularioDto) {
    await this.findOne(id);
    const datosActualizados: Partial<TipoFormulario> = { ...updateDto };

    if (updateDto.nombre) {
      const nombreSanitizado = updateDto.nombre.trim();
      const colision = await this.tiposFormularioRepository.findOne({
        where: { nombre: ILike(nombreSanitizado), id: Not(id), fecha_desactivacion: IsNull() },
      });
      if (colision) {
        throw new BadRequestException('El nuevo nombre ya está en uso por otro tipo de formulario.');
      }
      datosActualizados.nombre = nombreSanitizado;
    }

    await this.tiposFormularioRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    // No se permite borrar un tipo que todavía tiene formularios (fichas) activos.
    // Esto evita romper la integridad de formularios que ya existen apuntando a este tipo.
    const formulariosAsociados = await this.formulariosRepository.count({
      where: { tipo_formulario_id: id, fecha_desactivacion: IsNull() },
    });

    if (formulariosAsociados > 0) {
      throw new BadRequestException(
        'No se puede eliminar este tipo de formulario porque tiene formularios activos asociados. Elimina o desactiva primero esos formularios.',
      );
    }

    await this.tiposFormularioRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Tipo de formulario desactivado con éxito.' };
  }
}