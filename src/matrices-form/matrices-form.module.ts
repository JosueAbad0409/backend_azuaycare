import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilaMatriz } from './entities/fila-matriz.entity';
import { ColumnaMatriz } from './entities/columna-matriz.entity';
import { MatricesFormService } from './matrices-form.service';
import { MatricesFormController } from './matrices-form.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FilaMatriz, ColumnaMatriz])],
  controllers: [MatricesFormController],
  providers: [MatricesFormService],
  exports: [TypeOrmModule, MatricesFormService],
})
export class MatricesFormModule {}