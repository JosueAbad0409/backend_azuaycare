import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoRespaldo } from './entities/documentos-respaldo.entity';
import { DocumentosRespaldoService } from './documentos-respaldo.service';
import { DocumentosRespaldoController } from './documentos-respaldo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentoRespaldo])],
  controllers: [DocumentosRespaldoController],
  providers: [DocumentosRespaldoService],
  exports: [TypeOrmModule, DocumentosRespaldoService],
})
export class DocumentosRespaldoModule {}