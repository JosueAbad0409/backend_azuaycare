import { Module } from '@nestjs/common';
import { PlantillasPdfService } from './plantillas-pdf.service';
import { PlantillasPdfController } from './plantillas-pdf.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlantillaPdf } from './entities/plantillas-pdf.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlantillaPdf])],
  controllers: [PlantillasPdfController],
  providers: [PlantillasPdfService],
})
export class PlantillasPdfModule {}
