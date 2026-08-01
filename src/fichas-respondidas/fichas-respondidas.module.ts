import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager'; // 1. IMPORTAR CacheModule
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { FichasRespondidasController } from './fichas-respondidas.controller';
import { FichasRespondidasService } from './fichas-respondidas.service';
import { NivelesEconomicosModule } from '../niveles-economicos/niveles-economicos.module';
import { FichaRespuestasListener } from './listeners/ficha-respuestas.listener'; 
import { MailModule } from 'src/mail/mail.module';
import { PdfModule } from '../common/pdf/pdf.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([FichaRespondida]),
    CacheModule.register({
      ttl: 43200000, // 12 horas de retención en RAM (en milisegundos)
      max: 100,      // Máximo 100 estructuras de formularios en memoria a la vez
    }),
    NivelesEconomicosModule,
    MailModule,
    PdfModule,
  ],
  controllers: [FichasRespondidasController],
  providers: [
    FichasRespondidasService, 
    FichaRespuestasListener,
  ],
  exports: [TypeOrmModule, FichasRespondidasService],
})
export class FichasRespondidasModule {}