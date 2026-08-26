import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UbicacionesService } from './ubicaciones.service';
import { UbicacionesController } from './ubicaciones.controller';
import { Pais } from './entities/pais.entity';
import { Provincia } from './entities/provincia.entity';
import { Canton } from './entities/canton.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pais, Provincia, Canton])],
  controllers: [UbicacionesController],
  providers: [UbicacionesService],
  exports: [UbicacionesService],
})
export class UbicacionesModule {}