import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';

describe('UsuariosService', () => {
  let service: UsuariosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: getRepositoryToken(Usuario),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});