import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; 
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';
import { DocumentosRespaldoService } from '../documentos-respaldo/documentos-respaldo.service';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { Formulario } from 'src/formularios/entities/formulario.entity';

// Interfaz para la respuesta precargada
export interface RespuestaPrecargadaItem {
  pregunta_id: string;
  valor_texto: string | null;
  valor_numerico: number | null;
  opciones_seleccionadas: string[];
}

@Injectable()
export class RespuestasFormularioService {
  constructor(
    @InjectRepository(RespuestasFormulario)
    private readonly respuestasRepository: Repository<RespuestasFormulario>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly documentosService: DocumentosRespaldoService, 
  ) {}

  async guardarMuchas(
    dtos: CreateRespuestasFormularioDto[], 
    usuarioId: string, 
    archivos?: Express.Multer.File[],
    esEnvioFinal: boolean = false,
  ) {
    if (!dtos.length) return { success: true, message: 'Sin respuestas para guardar.' };

    const fichasIdsUnicas = [...new Set(dtos.map(dto => dto.ficha_id))];
    
    for (const fId of fichasIdsUnicas) {
      const ficha = await this.dataSource.getRepository(FichaRespondida).findOne({ 
        where: { id: fId }, 
        select: { id: true, usuario_id: true, estado_ficha: true, formulario_id: true } as any
      });

      if (!ficha || (ficha as any).usuario_id !== usuarioId) {
        throw new ForbiddenException(`No tienes permiso para insertar respuestas en la ficha seleccionada.`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Limpieza previa de respuestas anteriores de la ficha
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

      // 🔥 LÓGICA DE CÁLCULO Y GESTIÓN DE ESTADO / PLAZOS
      if (fichaId) {
        const fichaActual = await queryRunner.manager.findOne(FichaRespondida, {
          where: { id: fichaId },
          relations: { formulario: true },
        });

        const respuestasConPreguntas = await queryRunner.manager.find(RespuestasFormulario, {
          where: { ficha_id: fichaId },
          relations: { pregunta: true },
        });

        const totalesDinamicos: Record<string, number> = {
          ingresos: 0,
          egresos: 0,
        };

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

        const datosUpdateFicha: any = {
          total_ingresos: totalesDinamicos.ingresos || 0,
          total_egresos: totalesDinamicos.egresos || 0,
          balance_final: (totalesDinamicos.ingresos || 0) - (totalesDinamicos.egresos || 0),
        };

        // Si cambia de BORRADOR a ENVIADA y el formulario tiene plazo de modificación configurado
        if (fichaActual && esEnvioFinal && (fichaActual as any).estado_ficha === 'BORRADOR') {
          datosUpdateFicha.estado_ficha = 'ENVIADA';
          
          if (fichaActual.formulario?.dias_plazo_modificacion) {
            const fechaLimite = new Date();
            fechaLimite.setDate(fechaLimite.getDate() + fichaActual.formulario.dias_plazo_modificacion);
            datosUpdateFicha.fecha_limite_edicion = fechaLimite;
          } else {
            datosUpdateFicha.fecha_limite_edicion = null;
          }
        }

        await queryRunner.manager.update(FichaRespondida, fichaId, datosUpdateFicha);
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
        message: `${respuestasGuardadas.length} respuestas procesadas y almacenadas con éxito.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerPrecarga(periodoNuevoId: string, usuarioId: string) {
    const formularioNuevo = await this.dataSource.getRepository(Formulario).findOne({
      where: { periodo_id: periodoNuevoId, publicado: true, fecha_desactivacion: IsNull() },
      relations: {
        secciones: {
          preguntas: true,
        },
      },
    });

    if (!formularioNuevo) {
      throw new NotFoundException('No existe un formulario publicado para el nuevo periodo especificado.');
    }

    if (!formularioNuevo.periodo_origen_id) {
      return {
        es_precargable: false,
        message: 'El formulario del nuevo periodo no proviene de una clonación previa.',
        respuestas_precargadas: [],
        preguntas_nuevas_pendientes: [],
      };
    }

    const fichaAnterior = await this.dataSource.getRepository(FichaRespondida).findOne({
      where: { 
        usuario_id: usuarioId, 
        formulario_id: formularioNuevo.periodo_origen_id,
        fecha_desactivacion: IsNull() 
      } as any,
      order: { created_at: 'DESC' } as any,
      relations: {
        respuestas: {
          opcionesSeleccionadas: true,
          pregunta: true,
        },
      } as any,
    });

    if (!fichaAnterior) {
      return {
        es_precargable: false,
        message: 'No se encontró una ficha respondida en el periodo anterior para este usuario.',
        respuestas_precargadas: [],
        preguntas_nuevas_pendientes: [],
      };
    }

    const preguntasFormularioNuevo = (formularioNuevo.secciones || []).flatMap(s => s.preguntas || []);
    
    // Tipado explícito para evitar inferencia de 'never[]'
    const respuestasPrecargadas: RespuestaPrecargadaItem[] = [];
    const preguntasNuevasPendientes: string[] = [];

    const respuestasAnteriores = (fichaAnterior as any).respuestas || [];

    for (const preguntaNueva of preguntasFormularioNuevo) {
      const respuestaCoincidente = respuestasAnteriores.find(
        (r: any) => r.pregunta?.enunciado === preguntaNueva.enunciado || r.pregunta_id === preguntaNueva.id
      );

      if (respuestaCoincidente) {
        respuestasPrecargadas.push({
          pregunta_id: preguntaNueva.id,
          valor_texto: respuestaCoincidente.valor_texto,
          valor_numerico: respuestaCoincidente.valor_numerico,
          opciones_seleccionadas: respuestaCoincidente.opcionesSeleccionadas?.map((o: any) => o.opcion_id) || [],
        });
      } else {
        preguntasNuevasPendientes.push(preguntaNueva.id);
      }
    }

    return {
      es_precargable: true,
      ficha_origen_id: fichaAnterior.id,
      respuestas_precargadas: respuestasPrecargadas,
      preguntas_nuevas_pendientes: preguntasNuevasPendientes,
    };
  }

  async findByFicha(fichaId: string) {
    return this.respuestasRepository.find({
      where: { ficha_id: fichaId, fecha_desactivacion: IsNull() },
      relations: { pregunta: true, opcionesSeleccionadas: true, documentos: true },
    });
  }

  findAll(skip: number = 0, take: number = 10) {
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
      relations: { pregunta: true, opcionesSeleccionadas: true },
    });
    if (!respuesta) {
      throw new NotFoundException('La respuesta solicitada no existe o está inactiva.');
    }
    return respuesta;
  }
}