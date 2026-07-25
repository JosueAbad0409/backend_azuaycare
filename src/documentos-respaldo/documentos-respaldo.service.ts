import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';
import { Express } from 'express'; // 🔒 Importación necesaria para procesar archivos

// 🔥 1. IMPORTAR SUPABASE
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DocumentosRespaldoService {
  // 🔥 2. DECLARAR LA PROPIEDAD EN LA CLASE
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(DocumentoRespaldo)
    private readonly documentosRepository: Repository<DocumentoRespaldo>,
    private readonly dataSource: DataSource,
  ) {
    // 🔥 3. INICIALIZAR EL CLIENTE CON LAS VARIABLES DEL .ENV
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string
    );
  }

  // Método privado para validar que el documento pertenezca a la ficha del usuario
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
    return this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
    });
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

  // 🔥 NUEVO MÉTODO IMPLEMENTADO CON SUPABASE STORAGE
  async subirMultiples(archivos: Express.Multer.File[]): Promise<Partial<DocumentoRespaldo>[]> {
    if (!archivos || archivos.length === 0) return [];

    // El nombre exacto del bucket que creaste en el paso anterior
    const BUCKET_NAME = 'documentos_azuaycare'; 

    const promesas = archivos.map(async (archivo) => {
      // 1. Limpiar el nombre original y generar un nombre único
      const extension = archivo.originalname.split('.').pop();
      const nombreLimpio = archivo.originalname.replace(/[^a-zA-Z0-9]/g, '_');
      const nombreUnico = `${Date.now()}-${nombreLimpio}.${extension}`;
      
      // 2. Subir el archivo al bucket de Supabase
      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .upload(nombreUnico, archivo.buffer, {
          contentType: archivo.mimetype,
          upsert: false,
        });

      // Si falla la subida, se detiene todo y el backend hace rollback
      if (error) {
        throw new InternalServerErrorException(`Error al subir documento a Supabase: ${error.message}`);
      }

      // 3. Obtener la URL pública del archivo recién subido
      const { data: urlData } = this.supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      // 4. Retornar los datos mapeados EXACTAMENTE a las columnas de tu Entidad
      return {
        ruta_archivo: urlData.publicUrl,
        nombre_original: archivo.originalname,
        mime_type: archivo.mimetype,
        tamanio_bytes: archivo.size,
      };
    });

    return Promise.all(promesas);
  }
}