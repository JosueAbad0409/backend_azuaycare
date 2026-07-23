import { Injectable, OnApplicationBootstrap, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedAdmin();
  }

  private async seedRoles() {
    const rolesPredefinidos = [
      'COORDINADOR_BIENESTAR',
      'COORDINADOR_CARRERA',
      'ESTUDIANTE',
      'INVITADO',
    ];

    try {
      const rolesExistentes = await this.rolesRepository.find({
        where: { nombre: In(rolesPredefinidos) },
        select: { nombre: true },
      });

      const nombresExistentes = new Set(rolesExistentes.map((r) => r.nombre));
      const rolesACrear = rolesPredefinidos
        .filter((nombre) => !nombresExistentes.has(nombre))
        .map((nombre) => this.rolesRepository.create({ nombre }));

      if (rolesACrear.length > 0) {
        await this.rolesRepository.insert(rolesACrear);
        console.log(`[Seed] Roles inicializados: ${rolesACrear.map(r => r.nombre).join(', ')}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('[Seed Error] No se pudo inicializar los roles:', message);
    }
  }

  private async seedAdmin() {
    const adminEmail = 'admin.bienestar@tecazuay.edu.ec';
    const adminId = 'a1a2a3a4-b5b6-c7c8-d9d0-e1e2e3e4e5e6'; 

    try {
      const existeAdmin = await this.usuariosRepository.findOne({
        where: { email_institucional: adminEmail },
        select: { id: true },
      });

      if (!existeAdmin) {
        const rolAdmin = await this.rolesRepository.findOne({ 
          where: { nombre: 'COORDINADOR_BIENESTAR' },
          select: { id: true },
        });

        if (!rolAdmin) {
          console.warn('[Seed Warning] Rol COORDINADOR_BIENESTAR no disponible. No se sembró el Administrador.');
          return;
        }

        const nuevoAdmin = this.usuariosRepository.create({
          id: adminId,
          google_id: 'ADMIN_MANUAL_OAUTH', 
          email_institucional: adminEmail,
          primer_nombre: 'Administrador',
          primer_apellido: 'General',
          cedula: '0101010101',
          rol: rolAdmin,
        });

        await this.usuariosRepository.insert(nuevoAdmin);
        console.log(`[Seed] Administrador supremo creado con éxito: ${adminEmail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('[Seed Error] No se pudo sembrar el administrador supremo:', message);
    }
  }

  findAll(skip: number=0, take: number=10) {
    return this.rolesRepository.find({
      where: { fecha_desactivacion: IsNull() },
      skip,
      take,
      select: { id: true, nombre: true },
      order: { nombre: 'ASC' }
    });
  }

  async findOne(id: string) {
    const rol = await this.rolesRepository.findOne({
      where: { id, fecha_desactivacion: IsNull() },
      select: { id: true, nombre: true },
    });
    
    if (!rol) throw new NotFoundException('El rol solicitado no existe o está inactivo.');
    return rol;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.rolesRepository.update(id, { fecha_desactivacion: new Date() });
    return { message: 'Rol desactivado con éxito' };
  }
}