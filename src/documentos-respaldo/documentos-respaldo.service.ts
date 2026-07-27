import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';
import { Express } from 'express'; 

import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DocumentosRespaldoService {
  private supabase: SupabaseClient;

  // Definimos el nombre del bucket como constante de clase para reutilizarlo
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

  private async validarPropiedadDocumento(respuestaId: string, usuarioId: string, rol: string) {
    if (rol.includes('COORDINADOR')) return true;

    const resultado = await this.dataSource.query(
      `SELECT f.usuario_id 
       FROM respuestas_formulario r 
       INNER JOIN fichas_respondidas f ON r.ficha_id = f.id 
       WHERE r.id = $1`, 
      [respuestaId]
    );

    if (!resultado.length || resultado[0].usuario_id !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para gestionar los documentos de esta respuesta.');
    }
  }

  async create(createDto: CreateDocumentosRespaldoDto, usuarioId: string, rol: string) {
    await this.validarPropiedadDocumento(createDto.respuesta_id, usuarioId, rol);
    const nuevoDocumento = this.documentosRepository.create(createDto);
    return this.documentosRepository.save(nuevoDocumento);
  }

  async findByRespuesta(respuestaId: string, usuarioId: string, rol: string) {
    await this.validarPropiedadDocumento(respuestaId, usuarioId, rol);
    
    const documentos = await this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
    });

    // 🔥 SEGURIDAD: Transformar el path interno en una URL firmada de corta duración
    for (const doc of documentos) {
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(doc.ruta_archivo, 60); // Válido por 60 segundos

      if (!error && data) {
        doc.ruta_archivo = data.signedUrl;
      }
    }

    return documentos;
  }

  async remove(id: string, usuarioId: string, rol: string) {
    const documento = await this.documentosRepository.findOne({ where: { id } });
    if (!documento) {
      throw new NotFoundException('El documento de respaldo no existe o ya fue removido.');
    }

    await this.validarPropiedadDocumento(documento.respuesta_id, usuarioId, rol);

    await this.documentosRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    return { message: 'Documento de respaldo eliminado con éxito.' };
  }

  async subirMultiples(archivos: Express.Multer.File[]): Promise<Partial<DocumentoRespaldo>[]> {
    if (!archivos || archivos.length === 0) return [];

    const promesas = archivos.map(async (archivo) => {
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

      // 🔥 SEGURIDAD: Retornamos ÚNICAMENTE el path (data.path) a la base de datos
      return {
        ruta_archivo: data.path, 
        nombre_original: archivo.originalname,
        mime_type: archivo.mimetype,
        tamanio_bytes: archivo.size,
      };
    });

    return Promise.all(promesas);
  }
}