import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';

@Injectable()
export class DocumentosRespaldoService {
  constructor(
    @InjectRepository(DocumentoRespaldo)
    private readonly documentosRepository: Repository<DocumentoRespaldo>,
    private readonly dataSource: DataSource,
  ) {}

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
}