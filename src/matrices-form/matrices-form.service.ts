import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FilaMatriz } from './entities/fila-matriz.entity';
import { ColumnaMatriz } from './entities/columna-matriz.entity';
import { CreateFilaMatrizDto, CreateColumnaMatrizDto } from './dto/create-matrices-form.dto';


@Injectable()
export class MatricesFormService {
  constructor(
    @InjectRepository(FilaMatriz)
    private readonly filasRepository: Repository<FilaMatriz>,
    @InjectRepository(ColumnaMatriz)
    private readonly columnasRepository: Repository<ColumnaMatriz>,
  ) {}

  // ==================== FILAS ====================
  async createFila(createDto: CreateFilaMatrizDto) {
    const nuevaFila = this.filasRepository.create(createDto);
    return this.filasRepository.save(nuevaFila);
  }

  async findFilasByPregunta(preguntaId: string) {
    return this.filasRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async removeFila(id: string) {
    const fila = await this.filasRepository.findOne({ where: { id, fecha_desactivacion: IsNull() } });
    if (!fila) throw new NotFoundException('Fila de matriz no encontrada.');

    await this.filasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Fila eliminada con éxito.' };
  }

  // ==================== COLUMNAS ====================
  async createColumna(createDto: CreateColumnaMatrizDto) {
    const nuevaColumna = this.columnasRepository.create(createDto);
    return this.columnasRepository.save(nuevaColumna);
  }

  async findColumnasByPregunta(preguntaId: string) {
    return this.columnasRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async removeColumna(id: string) {
    const columna = await this.columnasRepository.findOne({ where: { id, fecha_desactivacion: IsNull() } });
    if (!columna) throw new NotFoundException('Columna de matriz no encontrada.');

    await this.columnasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Columna eliminada con éxito.' };
  }

  // ==================== OBTENER ESTRUCTURA COMPLETA ====================
  // Útil para el frontend cuando renderiza la tabla completa de una pregunta
  async obtenerEstructuraMatriz(preguntaId: string) {
    const [filas, columnas] = await Promise.all([
      this.findFilasByPregunta(preguntaId),
      this.findColumnasByPregunta(preguntaId),
    ]);

    return { filas, columnas };
  }
}