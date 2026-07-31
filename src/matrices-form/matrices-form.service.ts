import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FilaMatriz } from './entities/fila-matriz.entity';
import { ColumnaMatriz } from './entities/columna-matriz.entity';
import { CreateFilaMatrizDto, CreateColumnaMatrizDto } from './dto/create-matrices-form.dto';
import { Pregunta } from '../preguntas/entities/pregunta.entity';
import { Seccion } from '../secciones/entities/secciones.entity';
import { Formulario } from '../formularios/entities/formulario.entity';

@Injectable()
export class MatricesFormService {
  constructor(
    @InjectRepository(FilaMatriz)
    private readonly filasRepository: Repository<FilaMatriz>,
    @InjectRepository(ColumnaMatriz)
    private readonly columnasRepository: Repository<ColumnaMatriz>,
    @InjectRepository(Pregunta)
    private readonly preguntasRepository: Repository<Pregunta>,
    @InjectRepository(Seccion)
    private readonly seccionesRepository: Repository<Seccion>,
    @InjectRepository(Formulario)
    private readonly formulariosRepository: Repository<Formulario>,
  ) {}

  private async validarFormularioModificablePorPregunta(preguntaId: string) {
    const pregunta = await this.preguntasRepository.findOne({ where: { id: preguntaId, fecha_desactivacion: IsNull() } });
    if (!pregunta) throw new NotFoundException('Pregunta no encontrada.');

    const seccion = await this.seccionesRepository.findOne({ where: { id: pregunta.seccion_id, fecha_desactivacion: IsNull() } });
    if (!seccion) throw new NotFoundException('Sección no encontrada.');

    const formulario = await this.formulariosRepository.findOne({ where: { id: seccion.formulario_id, fecha_desactivacion: IsNull() } });
    if (formulario && (formulario.publicado || formulario.bloqueado)) {
      throw new BadRequestException('El formulario está congelado (publicado o bloqueado). No se permiten modificaciones en la matriz.');
    }
  }

  // ==================== FILAS ====================
  async createFila(createDto: CreateFilaMatrizDto) {
    await this.validarFormularioModificablePorPregunta(createDto.pregunta_id);

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
    
    await this.validarFormularioModificablePorPregunta(fila.pregunta_id);

    await this.filasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Fila eliminada con éxito.' };
  }

  // ==================== COLUMNAS ====================
  async createColumna(createDto: CreateColumnaMatrizDto) {
    await this.validarFormularioModificablePorPregunta(createDto.pregunta_id);

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

    await this.validarFormularioModificablePorPregunta(columna.pregunta_id);

    await this.columnasRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Columna eliminada con éxito.' };
  }

  // ==================== OBTENER ESTRUCTURA COMPLETA ====================
  async obtenerEstructuraMatriz(preguntaId: string) {
    const [filas, columnas] = await Promise.all([
      this.findFilasByPregunta(preguntaId),
      this.findColumnasByPregunta(preguntaId),
    ]);

    return { filas, columnas };
  }
}