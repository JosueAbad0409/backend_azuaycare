import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { PerfilUsuarioPeriodo } from '../usuarios/entities/perfil-usuario-periodo.entity';
import { DocumentosRespaldoService } from './documentos-respaldo.service';
import { DocumentosRespaldoController } from './documentos-respaldo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentoRespaldo, PerfilUsuarioPeriodo])],
  controllers: [DocumentosRespaldoController],
  providers: [DocumentosRespaldoService],
  exports: [TypeOrmModule, DocumentosRespaldoService],
})
export class DocumentosRespaldoModule {}