import { Test, TestingModule } from '@nestjs/testing';
import { PerfilCoordinadorService } from './perfil-coordinador.service';

describe('PerfilCoordinadorService', () => {
  let service: PerfilCoordinadorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerfilCoordinadorService],
    }).compile();

    service = module.get<PerfilCoordinadorService>(PerfilCoordinadorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
