import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Seccion } from './entities/secciones.entity';
import { CreateSeccionDto } from './dto/create-secciones.dto';
import { UpdateSeccionDto } from './dto/update-secciones.dto';
import { Formulario } from '../formularios/entities/formulario.entity'; // Asegúrate de que la ruta sea correcta

@Injectable()
export class SeccionesService {
  constructor(
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  // 🔥 NUEVO: Validar que el formulario no esté publicado
  private async validarFormularioNoPublicado(formularioId: string) {
    const formulario = await this.formulariosRepository.findOne({ 
      where: { id: formularioId, fecha_desactivacion: IsNull() } 
    });
    if (formulario && formulario.publicado) {
      throw new BadRequestException('El diseño del formulario está congelado porque ya ha sido publicado. No se permiten modificaciones estructurales en las secciones.');
    }
  }

  async create(createSeccionDto: CreateSeccionDto, usuarioId: string) {
    await this.validarFormularioNoPublicado(createSeccionDto.formulario_id);

    const nuevaSeccion = this.seccionesRepository.create({
      ...createSeccionDto,
      creado_por: usuarioId,
    });
    return this.seccionesRepository.save(nuevaSeccion);
  }

  findAll(skip: number=0, take: number=10) {
    return this.seccionesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      order: { orden: 'ASC' },
    });
  }

  async findByFormulario(formularioId: string) {
    return this.seccionesRepository.find({
      where: { formulario_id: formularioId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findOne(id: string) {
    const seccion = await this.seccionesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });
    
    if (!seccion) {
      throw new NotFoundException('La sección solicitada no existe o está inactiva.');
    }
    return seccion;
  }

  async update(id: string, updateSeccionDto: UpdateSeccionDto, usuarioId: string) {
    const seccion = await this.findOne(id);
    await this.validarFormularioNoPublicado(seccion.formulario_id);

    await this.seccionesRepository.update(id, {
      ...updateSeccionDto,
      actualizado_por: usuarioId,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const seccion = await this.findOne(id);
    await this.validarFormularioNoPublicado(seccion.formulario_id);

    await this.seccionesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Sección dada de baja con éxito.' };
  }
}