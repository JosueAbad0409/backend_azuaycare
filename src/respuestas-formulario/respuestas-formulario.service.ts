import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; 
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';

@Injectable()
export class RespuestasFormularioService {
  constructor(
    @InjectRepository(RespuestasFormulario)
    private readonly respuestasRepository: Repository<RespuestasFormulario>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2, 
  ) {}

  async guardarMuchas(dtos: CreateRespuestasFormularioDto[], usuarioId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const respuestasGuardadas: RespuestasFormulario[] = [];
      let fichaId = '';

      for (const dto of dtos) {
        fichaId = dto.ficha_id;

        const nuevaRespuesta = this.respuestasRepository.create({
          ficha_id: dto.ficha_id,
          pregunta_id: dto.pregunta_id,
          valor_texto: dto.valor_texto ?? null,
          valor_numerico: dto.valor_numerico ?? null,
        });

        const respuestaSalvada = await queryRunner.manager.save(nuevaRespuesta);

        // Guardado de la relación múltiple (Tabla pivote)
        if (dto.opciones_seleccionadas && dto.opciones_seleccionadas.length > 0) {
          const registrosIntermedios = dto.opciones_seleccionadas.map(opcionId => ({
            respuesta_id: respuestaSalvada.id,
            opcion_id: opcionId,
          }));

          await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into('respuestas_opciones_seleccionadas')
            .values(registrosIntermedios)
            .execute();
        }

        respuestasGuardadas.push(respuestaSalvada);
      }

      await queryRunner.commitTransaction();

      // Disparamos el evento para que otro módulo/servicio recalcule totales en segundo plano
      if (fichaId) {
        this.eventEmitter.emit('ficha.respuestas.actualizadas', { fichaId });
      }

      return {
        success: true,
        message: `${respuestasGuardadas.length} respuestas procesadas y almacenadas con éxito.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByFicha(fichaId: string) {
    return this.respuestasRepository.find({
      where: { ficha_id: fichaId, fecha_desactivacion: IsNull() },
      relations: { pregunta: true },
    });
  }

  findAll() {
    return this.respuestasRepository.find({
      where: { fecha_desactivacion: IsNull() },
    });
  }

  async findOne(id: string) {
    const respuesta = await this.respuestasRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      relations: { pregunta: true },
    });
    if (!respuesta) {
      throw new NotFoundException('La respuesta solicitada no existe o está inactiva.');
    }
    return respuesta;
  }
}