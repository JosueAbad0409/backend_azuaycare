import { Module } from '@nestjs/common';
import { PlantillasPdfService } from './plantillas-pdf.service';
import { PlantillasPdfController } from './plantillas-pdf.controller';

@Module({
  controllers: [PlantillasPdfController],
  providers: [PlantillasPdfService],
})
export class PlantillasPdfModule {}
