import { Injectable } from '@nestjs/common';
import { CreatePerfilCoordinadorDto } from './dto/create-perfil-coordinador.dto';
import { UpdatePerfilCoordinadorDto } from './dto/update-perfil-coordinador.dto';

@Injectable()
export class PerfilCoordinadorService {
  create(createPerfilCoordinadorDto: CreatePerfilCoordinadorDto) {
    return 'This action adds a new perfilCoordinador';
  }

  findAll() {
    return `This action returns all perfilCoordinador`;
  }

  findOne(id: number) {
    return `This action returns a #${id} perfilCoordinador`;
  }

  update(id: number, updatePerfilCoordinadorDto: UpdatePerfilCoordinadorDto) {
    return `This action updates a #${id} perfilCoordinador`;
  }

  remove(id: number) {
    return `This action removes a #${id} perfilCoordinador`;
  }
}
