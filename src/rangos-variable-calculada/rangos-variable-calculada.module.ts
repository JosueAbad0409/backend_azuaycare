import { Module } from '@nestjs/common';
import { RangosVariableCalculadaService } from './rangos-variable-calculada.service';
import { RangosVariableCalculadaController } from './rangos-variable-calculada.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RangoVariableCalculada } from './entities/rangos-variable-calculada.entity';
import { Formulario } from 'src/formularios/entities/formulario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RangoVariableCalculada,Formulario])],
  controllers: [RangosVariableCalculadaController],
  providers: [RangosVariableCalculadaService],
})
export class RangosVariableCalculadaModule {}
