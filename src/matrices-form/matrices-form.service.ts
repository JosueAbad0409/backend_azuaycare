import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FilaMatriz } from './entities/fila-matriz.entity';
import { ColumnaMatriz } from './entities/columna-matriz.entity';
import { CreateFilaMatrizDto, CreateColumnaMatrizDto } from './dto/create-matrices-form.dto';

@Injectable()
export class MatricesFormService {
  constructor(
    @InjectRepository(FilaMatriz)
    private readonly filaRepository: Repository<FilaMatriz>,

    @InjectRepository(ColumnaMatriz)
    private readonly columnaRepository: Repository<ColumnaMatriz>,
  ) {}

  // Métodos para Filas
  async createFila(dto: CreateFilaMatrizDto) {
    const nuevaFila = this.filaRepository.create(dto);
    return this.filaRepository.save(nuevaFila);
  }

  async findFilasByPregunta(preguntaId: string) {
    return this.filaRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' }, 
    });
  }

  // Métodos para Columnas
  async createColumna(dto: CreateColumnaMatrizDto) {
    const nuevaColumna = this.columnaRepository.create(dto);
    return this.columnaRepository.save(nuevaColumna);
  }

  async findColumnasByPregunta(preguntaId: string) {
    return this.columnaRepository.find({
      where: { pregunta_id: preguntaId, fecha_desactivacion: IsNull() },
      order: { orden: 'ASC' }, 
    });
  }
}