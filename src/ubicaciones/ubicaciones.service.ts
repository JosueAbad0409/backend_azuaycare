import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pais } from './entities/pais.entity';
import { Provincia } from './entities/provincia.entity';
import { Canton } from './entities/canton.entity';

@Injectable()
export class UbicacionesService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Pais) private paisesRepository: Repository<Pais>,
    @InjectRepository(Provincia) private provinciasRepository: Repository<Provincia>,
    @InjectRepository(Canton) private cantonesRepository: Repository<Canton>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedUbicaciones();
  }

  // 👇 Llenado inicial automático
  private async seedUbicaciones() {
    // 1. Crear Ecuador si no existe
    let ecuador = await this.paisesRepository.findOne({ where: { nombre: 'Ecuador' } });
    if (!ecuador) {
      ecuador = this.paisesRepository.create({ nombre: 'Ecuador', nacionalidad: 'Ecuatoriana' });
      await this.paisesRepository.save(ecuador);
      
      // 2. Crear Provincia Azuay
      const azuay = this.provinciasRepository.create({ nombre: 'Azuay', pais_id: ecuador.id });
      await this.provinciasRepository.save(azuay);

      // 3. Crear Cantones de Azuay
      const cantonesAzuay = ['Cuenca', 'Gualaceo', 'Paute', 'Santa Isabel', 'Sigsig'].map(nombre => 
        this.cantonesRepository.create({ nombre, provincia_id: azuay.id })
      );
      await this.cantonesRepository.insert(cantonesAzuay);

      // (Opcional) Crear otros países comunes para que el select no esté vacío
      const otrosPaises = [
        { nombre: 'Colombia', nacionalidad: 'Colombiana' },
        { nombre: 'Perú', nacionalidad: 'Peruana' },
        { nombre: 'Venezuela', nacionalidad: 'Venezolana' }
      ];
      await this.paisesRepository.insert(otrosPaises);
      
      console.log('[Seed] Ubicaciones básicas (Ecuador, Azuay, Cuenca) creadas exitosamente.');
    }
  }

  // 👇 Métodos para que Angular consuma los datos
  async obtenerPaises() {
    return this.paisesRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' }
    });
  }

  async obtenerProvinciasPorPais(paisId: string) {
    return this.provinciasRepository.find({
      where: { pais_id: paisId, activo: true },
      order: { nombre: 'ASC' }
    });
  }

  async obtenerCantonesPorProvincia(provinciaId: string) {
    return this.cantonesRepository.find({
      where: { provincia_id: provinciaId, activo: true },
      order: { nombre: 'ASC' }
    });
  }
}