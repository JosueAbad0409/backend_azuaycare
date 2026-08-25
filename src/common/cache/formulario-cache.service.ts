import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class FormularioCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async invalidarPorFormularioId(formularioId: string): Promise<void> {
    if (!formularioId) return;
    await this.cacheManager.del(`form_struct_${formularioId}`);
  }
}