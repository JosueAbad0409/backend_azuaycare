import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Formulario } from './entities/formulario.entity';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';

@Injectable()
export class FormulariosService {
  constructor(
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  async create(createFormularioDto: CreateFormularioDto, usuarioId: string) {
    // Comprobar si ya existe una versión de formulario activa para ese periodo
    const ultimaVersion = await this.formulariosRepository.findOne({
      where: { periodo_id: createFormularioDto.periodo_id, fecha_desactivacion: IsNull() },
      order: { version: 'DESC' },
      select: { version: true },
    });

    const nuevaVersion = ultimaVersion ? ultimaVersion.version + 1 : 1;

    const nuevoFormulario = this.formulariosRepository.create({
      ...createFormularioDto,
      version: nuevaVersion,
      creado_por: usuarioId,
    });

    return this.formulariosRepository.save(nuevoFormulario);
  }

  findAll() {
    return this.formulariosRepository.find({
      where: { fecha_desactivacion: IsNull() },
      relations: { periodo: true, creador: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const formulario = await this.formulariosRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { periodo: true, creador: true },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario solicitado no existe o está inactivo.');
    }

    return formulario;
  }

  async publicaraFormulario(id: string) {
    const formulario = await this.findOne(id);
    
    if (formulario.publicado) {
      throw new BadRequestException('Este formulario ya se encuentra publicado.');
    }

    await this.formulariosRepository.update(id, {
      publicado: true,
      fecha_publicacion: new Date(),
    });

    return this.findOne(id);
  }

  async update(id: string, updateFormularioDto: UpdateFormularioDto) {
    await this.findOne(id);
    await this.formulariosRepository.update(id, updateFormularioDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const formulario = await this.findOne(id);
    
    if (formulario.publicado) {
      throw new BadRequestException('No se puede eliminar un formulario que ya ha sido publicado formalmente.');
    }

    await this.formulariosRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Formulario dado de baja con éxito.' };
  }
}