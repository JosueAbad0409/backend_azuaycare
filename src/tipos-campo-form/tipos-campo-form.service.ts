import { Injectable, NotFoundException, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Not } from 'typeorm';
import { TipoCampoForm } from './entities/tipos-campo-form.entity';
import { CreateTipoCampoFormDto } from './dto/create-tipos-campo-form.dto';
import { UpdateTipoCampoFormDto } from './dto/update-tipos-campo-form.dto';

@Injectable()
export class TiposCampoFormService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(TipoCampoForm)
    private readonly tiposRepository: Repository<TipoCampoForm>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedTiposCampo();
  }

  private async seedTiposCampo() {
    // 🚀 DICCIONARIO DE CAMPOS ROBUSTOS PARA EL MOTOR DE FORMULARIOS
    const tiposDefecto = [
      // --- Texto y formatos libres ---
      { nombre: 'TEXTO_CORTO', descripcion: 'Campo de texto de una sola línea (ej. nombres, calles)' },
      { nombre: 'TEXTO_LARGO', descripcion: 'Área de texto para descripciones o comentarios extensos' },
      
      // --- Validaciones Estrictas de Formato ---
      { nombre: 'CORREO', descripcion: 'Validación estricta de estructura de e-mail (ej. usuario@dominio.com)' },
      { nombre: 'CEDULA', descripcion: 'Validación de cédula ecuatoriana mediante algoritmo oficial de módulo 10' },
      { nombre: 'RUC', descripcion: 'Validación de Registro Único de Contribuyentes (13 dígitos)' },
      { nombre: 'TELEFONO', descripcion: 'Validación estricta numérica (exactamente 10 dígitos, útil para celulares o fijos)' },
      
      // --- Numéricos ---
      { nombre: 'NUMERICO_ENTERO', descripcion: 'Solo acepta números enteros (ej. cantidad de hijos, edad)' },
      { nombre: 'NUMERICO_DECIMAL', descripcion: 'Acepta números con decimales (ej. sueldo, peso en kg, estatura)' },
      
      // --- Fechas y Tiempos ---
      { nombre: 'FECHA', descripcion: 'Selector nativo de fecha (Date) con validación YYYY-MM-DD' },
      { nombre: 'HORA', descripcion: 'Selector de hora (Time) con validación HH:mm' },
      
      // --- Selecciones y Estructuras Complejas ---
      { nombre: 'SELECCION_UNICA', descripcion: 'Lista desplegable o Radio Buttons donde solo se elige una opción' },
      { nombre: 'SELECCION_MULTIPLE', descripcion: 'Casillas (Checkboxes) donde se pueden elegir varias opciones a la vez' },
      { nombre: 'MATRIZ', descripcion: 'Estructura de filas y columnas para encuestas o escalas de Likert' },
      
      // --- Archivos ---
      { nombre: 'ARCHIVO', descripcion: 'Campo para subir documentos (PDF, JPG, PNG) limitados por tamaño' }
    ];

    try {
      const nombres = tiposDefecto.map(t => t.nombre);
      const existentes = await this.tiposRepository.find({
        where: { nombre: In(nombres) },
        select: { nombre: true },
      });

      const nombresExistentes = new Set(existentes.map(e => e.nombre));
      const aCrear = tiposDefecto
        .filter(t => !nombresExistentes.has(t.nombre))
        .map(t => this.tiposRepository.create(t));

      if (aCrear.length > 0) {
        await this.tiposRepository.insert(aCrear);
        console.log(`[Seed] Tipos de campos inicializados con éxito. Nuevos campos: ${aCrear.length}`);
      }
    } catch (error: any) { 
      console.error('[Seed Error] No se pudieron inicializar los tipos de campos:', error.message);
    }
  }

  async create(createDto: CreateTipoCampoFormDto) {
    const nombreSanitizado = createDto.nombre.toUpperCase().trim();

    const existe = await this.tiposRepository.findOne({
      where: { nombre: nombreSanitizado, fecha_desactivacion: IsNull() },
    });

    if (existe) {
      throw new BadRequestException('Ya existe un tipo de campo registrado con ese nombre.');
    }

    const nuevoTipo = this.tiposRepository.create({
      ...createDto,
      nombre: nombreSanitizado,
    });

    return this.tiposRepository.save(nuevoTipo);
  }

  findAll(skip: number=0, take: number=100) {
    // 🔥 Aumentado el límite de take por defecto para que al cargar el formulario 
    // lleguen todos los tipos de campos sin quedarse paginados.
    const limiteReal = Math.min(Math.max(Number(take) || 100, 1), 500);
    const skipReal = Math.max(Number(skip) || 0, 0);
    
    return this.tiposRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip: skipReal,
      take: limiteReal,
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const tipo = await this.tiposRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
    });

    if (!tipo) {
      throw new NotFoundException('El tipo de campo solicitado no existe o está inactivo.');
    }

    return tipo;
  }

  async update(id: string, updateDto: UpdateTipoCampoFormDto) {
    await this.findOne(id);
    const datosActualizados: Partial<TipoCampoForm> = { ...updateDto };

    if (updateDto.nombre) {
      const nombreSanitizado = updateDto.nombre.toUpperCase().trim();
      const colision = await this.tiposRepository.findOne({
        where: { nombre: nombreSanitizado, id: Not(id), fecha_desactivacion: IsNull() }
      });
      if (colision) throw new BadRequestException('El nuevo nombre ya existe en otro tipo de campo.');
      datosActualizados.nombre = nombreSanitizado;
    }

    await this.tiposRepository.update(id, datosActualizados);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tiposRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Tipo de campo desactivado con éxito.' };
  }
}