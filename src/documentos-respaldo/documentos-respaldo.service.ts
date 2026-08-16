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

  // ----------------------------------------------------------------------
  // SUBIDA + CREACIÓN EN BD
  // ----------------------------------------------------------------------

  async subirYCrear(
    archivo: Express.Multer.File,
    body: { respuesta_id?: string; ficha_id?: string },
    usuarioId: string,
    rol: string,
  ): Promise<DocumentoRespaldo> {
    if (!archivo) throw new BadRequestException('No se recibió ningún archivo');

    if (body.respuesta_id) {
      await this.validarPropiedadDocumento(body.respuesta_id, usuarioId, rol);
    } else if (body.ficha_id) {
      await this.validarPropiedadFicha(body.ficha_id, usuarioId, rol);
    }

    const urlPublica = await this.subirArchivoAStorage(archivo);

    const nuevoDocumento = this.documentosRepository.create({
      usuario_id: usuarioId, 
      respuesta_id: body.respuesta_id ?? null,
      ficha_id: body.ficha_id ?? null,
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
      order: { created_at: 'DESC' } // 🔥 Ordenamos del más reciente al más antiguo para la galería
    });
  }

  async findByRespuesta(respuestaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadDocumento(respuestaId, usuarioId, rol);
    return await this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
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
  // ELIMINACIÓN FÍSICA (Base de datos + Storage)
  // ----------------------------------------------------------------------

  async remove(id: string, usuarioId: string, rol: string) {
    const documento = await this.documentosRepository.findOne({ where: { id } });
    
    if (!documento) {
      throw new NotFoundException('El documento de respaldo no existe o ya fue eliminado.');
    }

    // 1. Validar propiedad: Si no es coordinador, debe ser el dueño del archivo
    if (documento.usuario_id !== usuarioId && !rol.includes('COORDINADOR')) {
      throw new ForbiddenException('No tienes permiso para eliminar este documento.');
    }

    // 🔥 2. REGLA DE PROTECCIÓN: Bloquear si es evidencia de un formulario
    if (documento.respuesta_id !== null || documento.ficha_id !== null) {
      throw new ForbiddenException(
        'Acción denegada: No puedes eliminar este documento directamente porque está vinculado a una ficha institucional como evidencia. Debes actualizarlo o eliminarlo desde el formulario correspondiente.'
      );
    }

    // 3. Si es un archivo libre/suelto, procedemos con la eliminación física de Supabase
    try {
      const nombreArchivo = documento.ruta_archivo.split('/').pop();
      
      if (nombreArchivo) {
        const { error } = await this.supabase.storage
          .from(this.BUCKET_NAME)
          .remove([nombreArchivo]);
          
        if (error) {
          console.error(`Error de Supabase al borrar archivo: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error al intentar eliminar archivo de Supabase:', error);
    }

    // 4. Eliminación física de la base de datos
    await this.documentosRepository.delete(id);

    return { message: 'Documento independiente eliminado físicamente del sistema y del almacenamiento.' };
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