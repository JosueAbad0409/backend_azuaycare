import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.rol) {
      throw new ForbiddenException('No posee los permisos necesarios para realizar esta acción.');
    }

    const tieneRol = requiredRoles.includes(user.rol);
    if (!tieneRol) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere alguno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}