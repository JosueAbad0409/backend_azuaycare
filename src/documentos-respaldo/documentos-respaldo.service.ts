import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { CreateDocumentosRespaldoDto } from './dto/create-documentos-respaldo.dto';

@Injectable()
export class DocumentosRespaldoService {
  constructor(
    @InjectRepository(DocumentoRespaldo)
    private readonly documentosRepository: Repository<DocumentoRespaldo>,
  ) {}

  async create(createDto: CreateDocumentosRespaldoDto) {
    const nuevoDocumento = this.documentosRepository.create(createDto);
    return this.documentosRepository.save(nuevoDocumento);
  }

  async findByRespuesta(respuestaId: string) {
    return this.documentosRepository.find({
      where: { respuesta_id: respuestaId, fecha_desactivacion: IsNull() },
      relations: { respuesta: true, verificador: true },
    });
  }

  async remove(id: string) {
    const resultado = await this.documentosRepository.update(id, {
      fecha_desactivacion: new Date(),
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('El documento de respaldo no existe o ya fue removido.');
    }

    return { message: 'Documento de respaldo eliminado con éxito.' };
  }
}