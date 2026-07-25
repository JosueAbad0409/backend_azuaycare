import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; 
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';
import { DocumentosRespaldoService } from '../documentos-respaldo/documentos-respaldo.service';

@Injectable()
export class RespuestasFormularioService {
  constructor(
    @InjectRepository(RespuestasFormulario)
    private readonly respuestasRepository: Repository<RespuestasFormulario>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly documentosService: DocumentosRespaldoService, 
  ) {}

  async guardarMuchas(dtos: CreateRespuestasFormularioDto[], usuarioId: string, archivos?: Express.Multer.File[]) {
    if (!dtos.length) return { success: true, message: 'Sin respuestas para guardar.' };

    const fichasIdsUnicas = [...new Set(dtos.map(dto => dto.ficha_id))];
    
    for (const fId of fichasIdsUnicas) {
      const ficha = await this.dataSource.getRepository('FichaRespondida').findOne({ 
        where: { id: fId }, 
        select: { usuario_id: true } 
      });

      if (!ficha || (ficha as any).usuario_id !== usuarioId) {
        throw new ForbiddenException(`No tienes permiso para insertar respuestas en la ficha seleccionada.`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Limpieza previa de respuestas para la(s) ficha(s)
      for (const fId of fichasIdsUnicas) {
        await queryRunner.manager.delete(RespuestasFormulario, { ficha_id: fId });
      }

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

      // 🔥 LÓGICA DINÁMICA DE CÁLCULO USANDO variable_calculo
      if (fichaId) {
        // 1. Consultamos las respuestas usando el formato de objeto para relations
        const respuestasConPreguntas = await queryRunner.manager.find(RespuestasFormulario, {
          where: { ficha_id: fichaId },
          relations: { pregunta: true }, // 👈 Corregido a objeto para evitar errores de TypeScript
        });

        // 2. Inicializamos acumuladores dinámicos
        const totalesDinamicos: Record<string, number> = {
          ingresos: 0,
          egresos: 0,
        };

        // 3. Recorremos y sumamos basándonos en la etiqueta de la pregunta
        for (const resp of respuestasConPreguntas) {
          const variable = resp.pregunta?.variable_calculo;
          const valorNum = resp.valor_numerico;

          if (variable && valorNum !== null && valorNum !== undefined) {
            const key = variable.toLowerCase();
            if (totalesDinamicos[key] === undefined) {
              totalesDinamicos[key] = 0;
            }
            totalesDinamicos[key] += Number(valorNum);
          }
        }

        // 4. Actualizamos la ficha respondida dentro de la misma transacción
        await queryRunner.manager.update('FichaRespondida', fichaId, {
          total_ingresos: totalesDinamicos.ingresos || 0,
          total_egresos: totalesDinamicos.egresos || 0,
          balance_final: (totalesDinamicos.ingresos || 0) - (totalesDinamicos.egresos || 0),
        });
      }

      if (archivos && archivos.length > 0) {
        const documentosSubidos = await this.documentosService.subirMultiples(archivos);
        
        const documentosAGuardar = documentosSubidos.map(doc => ({
          ...doc,
          ficha_id: fichaId,
        }));
        
        await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into('documentos_respaldo') 
            .values(documentosAGuardar)
            .execute();
      }

      await queryRunner.commitTransaction();

      if (fichaId) {
        this.eventEmitter.emit('ficha.respuestas.actualizadas', { fichaId });
      }

      return {
        success: true,
        message: `${respuestasGuardadas.length} respuestas procesadas, calculadas y almacenadas con éxito.`,
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

  findAll( skip: number=0, take: number=10) {
    return this.respuestasRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      relations: { pregunta: true },
      order: { created_at: 'DESC' },
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