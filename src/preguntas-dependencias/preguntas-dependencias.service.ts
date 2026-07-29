import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PreguntaDependencia } from './entities/pregunta-dependencia.entity';
import { CreatePreguntaDependenciaDto } from './dto/create-pregunta-dependencia.dto';

@Injectable()
export class PreguntasDependenciasService {
  constructor(
    @InjectRepository(PreguntaDependencia)
    private readonly dependenciasRepository: Repository<PreguntaDependencia>,
  ) {}

  async create(createDto: CreatePreguntaDependenciaDto) {
    // 🔥 NUEVA REGLA: Anti-bucles infinitos
    if (createDto.pregunta_id === createDto.pregunta_disparadora_id) {
      throw new BadRequestException('Bucle detectado: Una pregunta no puede configurarse para depender de sí misma.');
    }

    if (!createDto.opcion_disparadora_id && !createDto.valor_disparador) {
      throw new BadRequestException('Debe proporcionar al menos una opción disparadora o un valor disparador.');
    }

    const nuevaDependencia = this.dependenciasRepository.create(createDto);
    return this.dependenciasRepository.save(nuevaDependencia);
  }

  async findByFormulario(formularioId: string) {
    return this.dependenciasRepository.find({
      where: {
        pregunta: { seccion: { formulario_id: formularioId } },
        fecha_desactivacion: IsNull(),
      },
      relations: {
        pregunta: true,
        preguntaDisparadora: true,
        opcionDisparadora: true,
      },
    });
  }

  async remove(id: string) {
    const resultado = await this.dependenciasRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('La regla de dependencia no existe o ya fue removida.');
    }

    return { message: 'Regla de dependencia eliminada lógicamente con éxito.' };
  }
}