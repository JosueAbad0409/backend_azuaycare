import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { Express } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';
import { PerfilUsuarioPeriodo } from 'src/usuarios/entities/perfil-usuario-periodo.entity';

@Injectable()
export class DocumentosRespaldoService {
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME = 'documentos_azuaycare';
  private readonly LIMITE_ARCHIVO_LIBRE_BYTES = 2 * 1024 * 1024; // 2MB

  constructor(
    @InjectRepository(DocumentoRespaldo)
    private readonly documentosRepository: Repository<DocumentoRespaldo>,
    private readonly dataSource: DataSource,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string
    );
  }

  // ----------------------------------------------------------------------
  // VALIDACIÓN DE PERMISOS
  // ----------------------------------------------------------------------

  private async validarPropiedadDocumento(respuestaId: string, usuarioId: string, rol: string) {
    if (rol.includes('COORDINADOR')) return true;

    const respuesta = await this.dataSource.manager.createQueryBuilder(RespuestasFormulario, 'r')
      .innerJoin('r.ficha', 'f')
      .where('r.id = :respuestaId', { respuestaId })
      .select(['f.usuario_id AS usuario_id'])
      .getRawOne();

    if (!respuesta || respuesta.usuario_id !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para gestionar los documentos de esta respuesta.');
    }
    return true;
  }

  private async validarPropiedadFicha(fichaId: string, usuarioId: string, rol: string) {
    if (rol.includes('COORDINADOR')) return true;

    const ficha = await this.dataSource.manager.createQueryBuilder(FichaRespondida, 'f')
      .where('f.id = :fichaId', { fichaId })
      .select(['f.usuario_id AS usuario_id'])
      .getRawOne();

    if (!ficha || ficha.usuario_id !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para ver los documentos de esta ficha.');
    }
    return true;
  }

  private async validarPropiedadPerfilPeriodo(perfilPeriodoId: string, usuarioId: string, rol: string) {
    if (rol.includes('COORDINADOR')) return true;

    const perfilPeriodo = await this.dataSource.manager.createQueryBuilder(PerfilUsuarioPeriodo, 'p')
      .where('p.id = :perfilPeriodoId', { perfilPeriodoId })
      .select(['p.usuario_id AS usuario_id'])
      .getRawOne();

    if (!perfilPeriodo || perfilPeriodo.usuario_id !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para gestionar los documentos de este perfil.');
    }
    return true;
  }

    private async calcularEspacioUsadoLibre(usuarioId: string): Promise<number> {
    const resultado = await this.documentosRepository
      .createQueryBuilder('doc')
      .select('COALESCE(SUM(doc.tamanio_bytes), 0)', 'total')
      .where('doc.usuario_id = :usuarioId', { usuarioId })
      .andWhere('doc.respuesta_id IS NULL')
      .andWhere('doc.ficha_id IS NULL')
      .andWhere('doc.perfil_periodo_id IS NULL')
      .andWhere('doc.fecha_desactivacion IS NULL')
      .getRawOne();

    return parseInt(resultado?.total ?? '0', 10);
  }

  // ----------------------------------------------------------------------
  // SUBIDA A SUPABASE Y GENERACIÓN DE URL PÚBLICA
  // ----------------------------------------------------------------------

  private async subirArchivoAStorage(archivo: Express.Multer.File): Promise<string> {
    const partesNombre = archivo.originalname.split('.');
    const extension = partesNombre.length > 1 ? partesNombre.pop() : '';
    const nombreSinExtension = partesNombre.join('');

    const nombreLimpio = nombreSinExtension.replace(/[^a-zA-Z0-9]/g, '_');
    const nombreUnico = extension
      ? `${Date.now()}-${nombreLimpio}.${extension}`
      : `${Date.now()}-${nombreLimpio}`;

    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .upload(nombreUnico, archivo.buffer, {
        contentType: archivo.mimetype,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(`Error al subir documento a Supabase: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // Función que elimina física y lógicamente documentos viejos reemplazados
  private async limpiarDocumentosPrevios(criterio: { respuesta_id?: string; ficha_id?: string; perfil_periodo_id?: string }) {
    const viejos = await this.documentosRepository.find({ where: criterio });
    
    for (const doc of viejos) {
      try {
        const nombreArchivo = doc.ruta_archivo.split('/').pop();
        if (nombreArchivo) {
          await this.supabase.storage.from(this.BUCKET_NAME).remove([nombreArchivo]);
        }
      } catch (error) {
        console.error(`Error al limpiar archivo viejo de Supabase:`, error);
      }
      // Lo eliminamos de la base de datos
      await this.documentosRepository.delete(doc.id);
    }
  }

  // ----------------------------------------------------------------------
  // SUBIDA + CREACIÓN EN BD
  // ----------------------------------------------------------------------

    async subirYCrear(
    archivo: Express.Multer.File,
    body: { respuesta_id?: string; ficha_id?: string; perfil_periodo_id?: string },
    usuarioId: string,
    rol: string,
  ): Promise<DocumentoRespaldo> {
    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

        // Un documento es "libre" (subido por el estudiante a su repositorio personal)
    // cuando no está vinculado a ninguna respuesta, ficha o perfil de periodo.
    // A estos archivos libres se les aplica un CUPO TOTAL de 2MB acumulado.
    // Las evidencias institucionales (con respuesta_id, ficha_id o perfil_periodo_id) no tienen límite.
    const esArchivoLibre = !body.respuesta_id && !body.ficha_id && !body.perfil_periodo_id;

    if (esArchivoLibre) {
      const espacioUsado = await this.calcularEspacioUsadoLibre(usuarioId);
      const espacioDisponible = this.LIMITE_ARCHIVO_LIBRE_BYTES - espacioUsado;

      if (archivo.size > espacioDisponible) {
        const disponibleMb = (Math.max(espacioDisponible, 0) / (1024 * 1024)).toFixed(2);
        const archivoMb = (archivo.size / (1024 * 1024)).toFixed(2);
        throw new BadRequestException(
          `No tienes espacio suficiente en tu repositorio de archivos independientes. Límite total: 2MB. Espacio disponible: ${disponibleMb}MB. El archivo pesa ${archivoMb}MB.`,
        );
      }
    }

    // Antes de subir, validamos propiedad y LIMPIAMOS cualquier archivo previo asociado a este campo
    if (body.respuesta_id) {
      await this.validarPropiedadDocumento(body.respuesta_id, usuarioId, rol);
      await this.limpiarDocumentosPrevios({ respuesta_id: body.respuesta_id });
    } else if (body.ficha_id) {
      await this.validarPropiedadFicha(body.ficha_id, usuarioId, rol);
      await this.limpiarDocumentosPrevios({ ficha_id: body.ficha_id });
    } else if (body.perfil_periodo_id) {
      await this.validarPropiedadPerfilPeriodo(body.perfil_periodo_id, usuarioId, rol);
      await this.limpiarDocumentosPrevios({ perfil_periodo_id: body.perfil_periodo_id });
    }

    const urlPublica = await this.subirArchivoAStorage(archivo);

    const nuevoDocumento = this.documentosRepository.create({
      usuario_id: usuarioId, 
      respuesta_id: body.respuesta_id ?? null,
      ficha_id: body.ficha_id ?? null,
      perfil_periodo_id: body.perfil_periodo_id ?? null,
      ruta_archivo: urlPublica,
      nombre_original: archivo.originalname,
      mime_type: archivo.mimetype,
      tamanio_bytes: archivo.size,
      verificado: null 
    });

    return this.documentosRepository.save(nuevoDocumento);
  }

  // ----------------------------------------------------------------------
  // CONSULTAS
  // ----------------------------------------------------------------------

    async findByUsuario(usuarioId: string) {
    return await this.documentosRepository.find({
      where: { usuario_id: usuarioId, fecha_desactivacion: IsNull() },
      relations: {
        ficha: { periodo: true },
        respuesta: { ficha: { periodo: true } },
      },
      order: { created_at: 'DESC' }
    });
  }

  async findByRespuesta(respuestaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadDocumento(respuestaId, usuarioId, rol);
    return await this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
    });
  }

  async findByPerfilPeriodo(perfilPeriodoId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadPerfilPeriodo(perfilPeriodoId, usuarioId, rol);
    return await this.documentosRepository.find({
      where: { perfil_periodo_id: perfilPeriodoId, fecha_desactivacion: IsNull() },
      relations: { verificador: true },
    });
  }

  async findByFicha(fichaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadFicha(fichaId, usuarioId, rol);
    return await this.documentosRepository.find({
      where: [
        { respuesta: { ficha_id: fichaId }, fecha_desactivacion: IsNull() },
        { ficha_id: fichaId, fecha_desactivacion: IsNull() },
      ],
      relations: { respuesta: { pregunta: true }, ficha: true, verificador: true },
    });
  }

  // ----------------------------------------------------------------------
  // VERIFICACIÓN
  // ----------------------------------------------------------------------

  async verificar(id: string, verificado: boolean, observacion: string | undefined, verificadorId: string) {
    const documento = await this.documentosRepository.findOne({ where: { id, fecha_desactivacion: IsNull() } });
    if (!documento) throw new NotFoundException('Documento no encontrado.');

    await this.documentosRepository.update(id, {
      verificado,
      observacion: observacion || null,
      usuario_verificador: verificadorId,
      fecha_verificacion: new Date(),
    });

    return this.documentosRepository.findOne({ where: { id } });
  }

  // ----------------------------------------------------------------------
  // ELIMINACIÓN FÍSICA
  // ----------------------------------------------------------------------

  async remove(id: string, usuarioId: string, rol: string) {
    const documento = await this.documentosRepository.findOne({ where: { id } });
    
    if (!documento) {
      throw new NotFoundException('El documento de respaldo no existe o ya fue eliminado.');
    }

    // Solo validamos que quien borra sea el dueño (o un coordinador).
    // SE ELIMINÓ EL CANDADO QUE PROHIBÍA BORRAR ARCHIVOS VINCULADOS, 
    // PARA QUE EL FORMULARIO PUEDA LIMPIARLOS SIN PROBLEMAS.
    if (documento.usuario_id !== usuarioId && !rol.includes('COORDINADOR')) {
      throw new ForbiddenException('No tienes permiso para eliminar este documento.');
    }

    try {
      const nombreArchivo = documento.ruta_archivo.split('/').pop();
      if (nombreArchivo) {
        const { error } = await this.supabase.storage
          .from(this.BUCKET_NAME)
          .remove([nombreArchivo]);
          
        if (error) console.error(`Error de Supabase al borrar archivo: ${error.message}`);
      }
    } catch (error) {
      console.error('Error al intentar eliminar archivo de Supabase:', error);
    }

    await this.documentosRepository.delete(id);

    return { message: 'Documento eliminado físicamente del sistema y del almacenamiento.' };
  }

  async subirMultiples(archivos: Express.Multer.File[]): Promise<Partial<DocumentoRespaldo>[]> {
    if (!archivos || archivos.length === 0) return [];

    const promesas = archivos.map(async (archivo) => {
      const urlPublica = await this.subirArchivoAStorage(archivo);
      return {
        ruta_archivo: urlPublica,
        nombre_original: archivo.originalname,
        mime_type: archivo.mimetype,
        tamanio_bytes: archivo.size,
      };
    });

    return Promise.all(promesas);
  }
}