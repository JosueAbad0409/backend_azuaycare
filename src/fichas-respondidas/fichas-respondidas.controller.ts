import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FichasRespondidasService } from './fichas-respondidas.service';
import { CreateFichaRespondidaDto } from './dto/create-ficha-respondida.dto';
import { UpdateFichaRespondidaDto } from './dto/update-ficha-respondida.dto';
import { ReabrirFichaDto } from './dto/reabrir-ficha.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { MailService } from 'src/mail/mail.service';

@Controller('fichas-respondidas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FichasRespondidasController {
  constructor(
    private readonly fichasService: FichasRespondidasService,
    private readonly mailService: MailService
  ) {}

  @Post()
  @Roles('ESTUDIANTE', 'INVITADO')
  create(@Body() createDto: CreateFichaRespondidaDto, @Req() req: RequestWithUser) {
    return this.fichasService.create(createDto, req.user.id);
  }

  @Get('test-correo')
  async testCorreo(@Query('email') email: string) {
    if (!email) return 'Por favor, envía un email como query param: ?email=tu_correo@gmail.com';
    
    await this.mailService.enviarConfirmacionFicha(email, 'Josué (Prueba)');
    return `Correo de prueba enviado a ${email}. Revisa tu bandeja de entrada o spam.`;
  }

  @Get('paginadas')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  getFichasPaginadas(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
    @Query('search') search = '',
    @Query('estado') estado = 'TODOS',
  ) {
    return this.fichasService.getFichasPaginadasYFiltradas(+skip, +take, search, estado);
  }

  @Get()
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 10,
  ) {
    return this.fichasService.findAll(+skip, +take);
  }

  @Get('mis-fichas')
  @Roles('ESTUDIANTE', 'INVITADO')
  findMisFichas(@Req() req: RequestWithUser) {
    return this.fichasService.findByUsuario(req.user.id);
  }

  @Get(':id/resumen')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  getResumenFicha(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.fichasService.getResumenFicha(id, req.user);
  }

  @Get(':id/pdf')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE')
  async descargarPdf(@Param('id') id: string, @Req() req: RequestWithUser, @Res() res: Response) {
    const buffer = await this.fichasService.generarPdfFicha(id, req.user);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ficha_${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    
    res.end(buffer);
  }

  @Get(':id')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA', 'ESTUDIANTE', 'INVITADO')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.fichasService.findOne(id, req.user);
  }

  @Patch(':id/cerrar-manual')
  @Roles('COORDINADOR_BIENESTAR')
  cerrarManual(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.fichasService.cerrarManual(id, req.user.id);
  }

  @Patch(':id/reabrir')
  @Roles('COORDINADOR_BIENESTAR')
  reabrir(
    @Param('id') id: string, 
    @Body() reabrirDto: ReabrirFichaDto,
    @Req() req: RequestWithUser,
  ) {
    return this.fichasService.reabrir(id, req.user.id, reabrirDto);
  }

  @Patch(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  update(@Param('id') id: string, @Body() updateDto: UpdateFichaRespondidaDto, @Req() req: RequestWithUser) {
    return this.fichasService.update(id, updateDto, req.user);
  }

  @Patch(':id/estado')
  @Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
  cambiarEstado(
    @Param('id') id: string, 
    @Body() body: { estado_ficha: string; comentario?: string },
    @Req() req: RequestWithUser
  ) {
    return this.fichasService.cambiarEstado(id, body.estado_ficha, req.user.id, body.comentario);
  }

  @Delete(':id')
  @Roles('COORDINADOR_BIENESTAR', 'ESTUDIANTE', 'INVITADO')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.fichasService.remove(id, req.user);
  }
}