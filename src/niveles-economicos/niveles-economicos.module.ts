import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NivelesEconomico } from './entities/niveles-economico.entity';
import { NivelesEconomicosController } from './niveles-economicos.controller';
import { NivelesEconomicosService } from './niveles-economicos.service';

@Module({
  imports: [TypeOrmModule.forFeature([NivelesEconomico])],
  controllers: [NivelesEconomicosController],
  providers: [NivelesEconomicosService],
  exports: [TypeOrmModule, NivelesEconomicosService],
})
export class NivelesEconomicosModule {}