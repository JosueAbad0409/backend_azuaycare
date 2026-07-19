import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoCampoForm } from './entities/tipos-campo-form.entity';
import { TiposCampoFormController } from './tipos-campo-form.controller';
import { TiposCampoFormService } from './tipos-campo-form.service';

@Module({
  imports: [TypeOrmModule.forFeature([TipoCampoForm])],
  controllers: [TiposCampoFormController],
  providers: [TiposCampoFormService],
  exports: [TypeOrmModule, TiposCampoFormService],
})
export class TiposCampoFormModule {}