import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';
import { CompletarPerfilDto } from './dto/CompletarPerfilDto ';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('COORDINADOR_BIENESTAR') 
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA') 
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.usuariosService.findAll(+skip, +take); // CORRECCIÓN
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO') 
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const usuarioActual = req.user;
    const esCoordinador = usuarioActual.rol.includes('COORDINADOR');
    
    if (!esCoordinador && usuarioActual.id !== id) {
      throw new ForbiddenException('No tienes autorización para ver los datos de otros usuarios.');
    }

    return this.usuariosService.findOne(id);
  }

  // El estudiante completa su propio registro (cédula, carrera y ciclo)
  // la primera vez que ingresa con Google. El id se toma del token JWT,
  // nunca de la URL, para que nadie pueda editar el perfil de otra persona.
  @Patch('perfil/completar')
  @Roles('ESTUDIANTE')
  completarPerfil(
    @Req() req: RequestWithUser,
    @Body() completarPerfilDto: CompletarPerfilDto,
  ) {
    return this.usuariosService.completarPerfilEstudiante(
      req.user.id,
      completarPerfilDto,
    );
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR')
  update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }
}