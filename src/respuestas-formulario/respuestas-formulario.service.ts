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
    // 🔒 Inyectamos el servicio de documentos para acoplarlo a la transacción
    private readonly documentosService: DocumentosRespaldoService, 
  ) {}

  // 🔒 Se añade el parámetro de archivos (o el DTO correspondiente para los documentos)
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

      // 🔒 SOLUCIÓN DE AUDITORÍA: Subida de archivos integrada a la transacción
      // Si esto falla por cualquier motivo (ej. timeout, error de S3, disco lleno), 
      // lanzará un throw y caerá directamente en el catch para hacer el rollback.
      if (archivos && archivos.length > 0) {
        const documentosSubidos = await this.documentosService.subirMultiples(archivos);
        
        // Vincular los documentos subidos a la base de datos usando el queryRunner
        // Asegúrate de tener la entidad DocumentoRespaldo importada
        const documentosAGuardar = documentosSubidos.map(doc => ({
          ...doc,
          ficha_id: fichaId,
        }));
        
        await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into('documentos_respaldo') // O usa la Entidad directamente
            .values(documentosAGuardar)
            .execute();
      }

      await queryRunner.commitTransaction();

      if (fichaId) {
        this.eventEmitter.emit('ficha.respuestas.actualizadas', { fichaId });
      }

      return {
        success: true,
        message: `${respuestasGuardadas.length} respuestas procesadas y almacenadas con éxito.`,
      };
    } catch (error) {
      // 🔒 Si falla la BD O falla la subida del documento, se revierte TODO.
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