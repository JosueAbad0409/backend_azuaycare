import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    NivelesEconomicosModule,
    MailModule,
    PdfModule
  ],
  controllers: [FichasRespondidasController],
  providers: [
    FichasRespondidasService, 
    FichaRespuestasListener
  ],
  exports: [TypeOrmModule, FichasRespondidasService],
})
export class FichasRespondidasModule {}