import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FichaRespondida } from './entities/ficha-respondida.entity';
import { FichasRespondidasController } from './fichas-respondidas.controller';
import { FichasRespondidasService } from './fichas-respondidas.service';

@Module({
  imports: [TypeOrmModule.forFeature([FichaRespondida])],
  controllers: [FichasRespondidasController],
  providers: [FichasRespondidasService],
  exports: [TypeOrmModule, FichasRespondidasService],
})
export class FichasRespondidasModule {}