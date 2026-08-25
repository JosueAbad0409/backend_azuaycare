import { Module } from '@nestjs/common';
import { FormularioCacheService } from './formulario-cache.service';

@Module({
  providers: [FormularioCacheService],
  exports: [FormularioCacheService],
})
export class FormularioCacheModule {}