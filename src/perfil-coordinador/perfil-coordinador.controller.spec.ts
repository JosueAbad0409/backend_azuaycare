import { Test, TestingModule } from '@nestjs/testing';
import { PerfilCoordinadorController } from './perfil-coordinador.controller';
import { PerfilCoordinadorService } from './perfil-coordinador.service';

describe('PerfilCoordinadorController', () => {
  let controller: PerfilCoordinadorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerfilCoordinadorController],
      providers: [PerfilCoordinadorService],
    }).compile();

    controller = module.get<PerfilCoordinadorController>(PerfilCoordinadorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
