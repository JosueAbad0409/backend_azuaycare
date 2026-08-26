import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UbicacionesService } from './ubicaciones.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'; // Asegúrate de que la ruta del guard sea correcta

@Controller('ubicaciones')
export class UbicacionesController {
  constructor(private readonly ubicacionesService: UbicacionesService) {}

  @UseGuards(JwtAuthGuard) // Protegemos las rutas para que solo usuarios logueados accedan
  @Get('paises')
  obtenerPaises() {
    return this.ubicacionesService.obtenerPaises();
  }

  @UseGuards(JwtAuthGuard)
  @Get('paises/:paisId/provincias')
  obtenerProvincias(@Param('paisId') paisId: string) {
    return this.ubicacionesService.obtenerProvinciasPorPais(paisId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('provincias/:provinciaId/cantones')
  obtenerCantones(@Param('provinciaId') provinciaId: string) {
    return this.ubicacionesService.obtenerCantonesPorProvincia(provinciaId);
  }
}