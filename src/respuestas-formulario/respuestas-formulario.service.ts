import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RespuestasFormulario } from './entities/respuestas-formulario.entity';
import { CreateRespuestasFormularioDto } from './dto/create-respuestas-formulario.dto';

@Injectable()
export class RespuestasFormularioService {
  constructor(
    @InjectRepository(RespuestasFormulario)
    private readonly respuestasRepository: Repository<RespuestasFormulario>,
  ) {}

  async guardarMuchas(dtos: CreateRespuestasFormularioDto[], usuarioId: string) {
    const nuevasRespuestas = dtos.map(dto => 
      this.respuestasRepository.create({
        ...dto,
        usuario_id: usuarioId,
      })
    );
    return this.respuestasRepository.save(nuevasRespuestas);
  }

  async findByUsuarioYFormulario(usuarioId: string, formularioId: string) {
    return this.respuestasRepository.find({
      where: { usuario_id: usuarioId, formulario_id: formularioId },
      relations: { pregunta: true, opcion: true },
    });
  }

  findAll() {
    return this.respuestasRepository.find({
      relations: { usuario: true, formulario: true },
    });
  }

  async findOne(id: string) {
    const respuesta = await this.respuestasRepository.findOne({
      where: { id },
      relations: { usuario: true, pregunta: true, opcion: true },
    });
    if (!respuesta) {
      throw new NotFoundException('La respuesta no existe.');
    }
    return respuesta;
  }
}