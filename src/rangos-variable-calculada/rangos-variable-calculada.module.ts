import { Module } from '@nestjs/common';
import { RangosVariableCalculadaService } from './rangos-variable-calculada.service';
import { RangosVariableCalculadaController } from './rangos-variable-calculada.controller';

@Module({
  controllers: [RangosVariableCalculadaController],
  providers: [RangosVariableCalculadaService],
})
export class RangosVariableCalculadaModule {}
