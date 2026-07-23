import { Controller, Get, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('COORDINADOR_BIENESTAR')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
