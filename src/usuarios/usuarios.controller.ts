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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from 'src/auth/interfaces/request-with-user.interface';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';

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
  findAll(@Query('skip') skip = 0, @Query('take') take = 1000) {
    return this.usuariosService.findAll(+skip, +take);
  }

  @Get('perfil/estado')
  @Roles('ESTUDIANTE', 'INVITADO')
  obtenerEstadoPerfil(@Req() req: RequestWithUser) {
    return this.usuariosService.obtenerEstadoPerfil(req.user.id);
  }

  @Patch('perfil/completar')
  @Roles('ESTUDIANTE', 'INVITADO')
  completarPerfil(
    @Req() req: RequestWithUser,
    @Body() completarPerfilDto: CompletarPerfilDto,
  ) {
    return this.usuariosService.completarPerfilEstudiante(
      req.user.id,
      req.user.rol,
      completarPerfilDto,
    );
  }

  @Post(':id/completar-perfil')
  @Patch(':id/completar-perfil')
  @Roles('COORDINADOR_BIENESTAR')
  completarPerfilEstudiantePorAdmin(
    @Param('id') id: string,
    @Query('rol') rolQuery: string,
    @Body() completarPerfilDto: CompletarPerfilDto,
  ) {
    const rolEfectivo = rolQuery || 'ESTUDIANTE';
    return this.usuariosService.completarPerfilEstudiante(
      id,
      rolEfectivo,
      completarPerfilDto,
    );
  }

  @Patch('foto')
  @Roles('ESTUDIANTE', 'INVITADO', 'COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  @UseInterceptors(FileInterceptor('foto'))
  subirFoto(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 2 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return this.usuariosService.actualizarFoto(req.user.id, file);
  }

  // 🟢 RUTA ESPECÍFICA REACTIVAR (Debe estar ANTES de @Patch(':id'))
  @Patch(':id/reactivar')
  @Roles('COORDINADOR_BIENESTAR')
  reactivar(@Param('id') id: string) {
    return this.usuariosService.reactivar(id);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const usuarioActual = req.user;
    const esCoordinador = usuarioActual.rol.includes('COORDINADOR');
    if (!esCoordinador && usuarioActual.id !== id) {
      throw new ForbiddenException(
        'No tienes autorización para ver los datos de otros usuarios.',
      );
    }
    return this.usuariosService.findOne(id);
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