import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialEstadosFicha } from './entities/historial-estados-ficha.entity';
import { HistorialEstadosFichaController } from './historial-estados-ficha.controller';
import { HistorialEstadosFichaService } from './historial-estados-ficha.service';

@Module({
  imports: [TypeOrmModule.forFeature([HistorialEstadosFicha])],
  controllers: [HistorialEstadosFichaController],
  providers: [HistorialEstadosFichaService],
  exports: [TypeOrmModule, HistorialEstadosFichaService],
})
export class HistorialEstadosFichaModule {}