import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Role } from './entities/role.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Usuario])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [TypeOrmModule, RolesService],
})
export class RolesModule {}