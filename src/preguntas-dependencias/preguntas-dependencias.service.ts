import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PreguntaDependencia } from './entities/pregunta-dependencia.entity';
import { CreatePreguntaDependenciaDto } from './dto/create-pregunta-dependencia.dto';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

@Injectable()
export class PreguntasDependenciasService {
  constructor(
    @InjectRepository(PreguntaDependencia)
    private readonly dependenciasRepository: Repository<PreguntaDependencia>,
    @InjectRepository(Pregunta)
    private readonly preguntasRepository: Repository<Pregunta>,
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  private async validarFormularioModificablePorPregunta(preguntaId: string) {
    const pregunta = await this.preguntasRepository.findOne({ where: { id: preguntaId, fecha_desactivacion: IsNull() } });
    if (!pregunta) throw new NotFoundException('Pregunta no encontrada.');

    const seccion = await this.seccionesRepository.findOne({ where: { id: pregunta.seccion_id, fecha_desactivacion: IsNull() } });
    if (!seccion) throw new NotFoundException('Sección no encontrada.');

    const formulario = await this.formulariosRepository.findOne({ where: { id: seccion.formulario_id, fecha_desactivacion: IsNull() } });
    if (formulario && (formulario.publicado || formulario.bloqueado)) {
      throw new BadRequestException('El formulario está congelado (publicado o bloqueado). No se permiten modificaciones en dependencias.');
    }
  }

  async create(createDto: CreatePreguntaDependenciaDto) {
    // Validar estado del formulario usando la pregunta dependiente
    await this.validarFormularioModificablePorPregunta(createDto.pregunta_id);

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
    const dependencia = await this.dependenciasRepository.findOne({ where: { id, fecha_desactivacion: IsNull() } });
    
    if (!dependencia) {
      throw new NotFoundException('La regla de dependencia no existe o ya fue removida.');
    }

    // Validar antes de borrar
    await this.validarFormularioModificablePorPregunta(dependencia.pregunta_id);

    try {
      // Eliminar físicamente la fila en la base de datos
      await this.dependenciasRepository.delete(id);
    } catch (error) {
      throw new BadRequestException(
        'No se pudo eliminar la regla de dependencia por un conflicto en la base de datos.'
      );
    }

    return { message: 'Regla de dependencia eliminada permanentemente con éxito.' };
  }
}