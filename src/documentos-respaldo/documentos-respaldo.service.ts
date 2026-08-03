import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { Express } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RespuestasFormulario } from 'src/respuestas-formulario/entities/respuestas-formulario.entity';
import { FichaRespondida } from 'src/fichas-respondidas/entities/ficha-respondida.entity';

@Injectable()
export class DocumentosRespaldoService {
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME = 'documentos_azuaycare';

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

  // ----------------------------------------------------------------------
  // SUBIDA A SUPABASE (helper interno reutilizable)
  // ----------------------------------------------------------------------

  private async subirArchivoAStorage(archivo: Express.Multer.File) {
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

    return data; // { path, ... }
  }

  // ----------------------------------------------------------------------
  // SUBIDA + CREACIÓN EN BD (endpoint principal /upload)
  // ----------------------------------------------------------------------

  /**
   * Sube el archivo a Supabase y crea el registro en BD en un solo paso.
   * Acepta respuesta_id (documento de pregunta) o ficha_id (documento general).
   */
  async subirYCrear(
    archivo: Express.Multer.File,
    body: { respuesta_id?: string; ficha_id?: string },
    usuarioId: string,
    rol: string,
  ): Promise<DocumentoRespaldo> {
    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

    if (!body.respuesta_id && !body.ficha_id) {
      throw new BadRequestException('Debes indicar respuesta_id o ficha_id para asociar el documento.');
    }

    if (body.respuesta_id) {
      await this.validarPropiedadDocumento(body.respuesta_id, usuarioId, rol);
    } else {
      await this.validarPropiedadFicha(body.ficha_id as string, usuarioId, rol);
    }

    const subido = await this.subirArchivoAStorage(archivo);

    const nuevoDocumento = this.documentosRepository.create({
      respuesta_id: body.respuesta_id ?? null,
      ficha_id: body.ficha_id ?? null,
      ruta_archivo: subido.path,
      nombre_original: archivo.originalname,
      mime_type: archivo.mimetype,
      tamanio_bytes: archivo.size,
    });

    return this.documentosRepository.save(nuevoDocumento);
  }

  // ----------------------------------------------------------------------
  // CONSULTAS
  // ----------------------------------------------------------------------

  async findByRespuesta(respuestaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadDocumento(respuestaId, usuarioId, rol);

    const documentos = await this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
    });

    return this.firmarUrls(documentos);
  }

  async findByFicha(fichaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadFicha(fichaId, usuarioId, rol);

    const documentos = await this.documentosRepository.find({
      where: [
        { respuesta: { ficha_id: fichaId }, fecha_desactivacion: IsNull() },
        { ficha_id: fichaId, fecha_desactivacion: IsNull() },
      ],
      relations: { respuesta: { pregunta: true }, ficha: true, verificador: true },
    });

    return this.firmarUrls(documentos);
  }

  private async firmarUrls(documentos: DocumentoRespaldo[]) {
    for (const doc of documentos) {
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(doc.ruta_archivo, 60);

      if (!error && data) {
        doc.ruta_archivo = data.signedUrl;
      }
    }
    return documentos;
  }

  // ----------------------------------------------------------------------
  // VERIFICACIÓN (coordinador)
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
  // ELIMINACIÓN LÓGICA
  // ----------------------------------------------------------------------

  async remove(id: string, usuarioId: string, rol: string) {
    const documento = await this.documentosRepository.findOne({ where: { id } });
    if (!documento) {
      throw new NotFoundException('El documento de respaldo no existe o ya fue removido.');
    }

    if (documento.respuesta_id) {
      await this.validarPropiedadDocumento(documento.respuesta_id, usuarioId, rol);
    } else if (documento.ficha_id) {
      await this.validarPropiedadFicha(documento.ficha_id, usuarioId, rol);
    } else {
      throw new ForbiddenException('Documento sin propietario válido.');
    }

    await this.documentosRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    return { message: 'Documento de respaldo eliminado con éxito.' };
  }

  // ----------------------------------------------------------------------
  // SUBIDA MÚLTIPLE (solo storage, sin crear registros — se mantiene por compatibilidad)
  // ----------------------------------------------------------------------

  async subirMultiples(archivos: Express.Multer.File[]): Promise<Partial<DocumentoRespaldo>[]> {
    if (!archivos || archivos.length === 0) return [];

    const promesas = archivos.map(async (archivo) => {
      const subido = await this.subirArchivoAStorage(archivo);
      return {
        ruta_archivo: subido.path,
        nombre_original: archivo.originalname,
        mime_type: archivo.mimetype,
        tamanio_bytes: archivo.size,
      };
    });

    return Promise.all(promesas);
  }
}