import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

// Convierte "DD/MM/AAAA" a un objeto Date. Retorna null si el formato o la fecha no son válidos.
export function parseFechaNacimiento(valor: string): Date | null {
  if (!valor || typeof valor !== 'string') return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!match) return null;

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const anio = parseInt(match[3], 10);

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  // Verifica que la fecha construida coincida exactamente (evita casos como 31/02/2020)
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return fecha;
}

@ValidatorConstraint({ name: 'isFechaNacimiento', async: false })
export class IsFechaNacimientoConstraint implements ValidatorConstraintInterface {
  validate(valor: string, args: ValidationArguments) {
    const fecha = parseFechaNacimiento(valor);
    if (!fecha) return false;

    const hoy = new Date();
    if (fecha.getTime() > hoy.getTime()) return false; // no puede ser una fecha futura

    const edadMinima = new Date(Date.UTC(hoy.getUTCFullYear() - 100, hoy.getUTCMonth(), hoy.getUTCDate()));
    if (fecha.getTime() < edadMinima.getTime()) return false; // edad máxima razonable: 100 años

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La fecha de nacimiento debe tener el formato DD/MM/AAAA y ser una fecha válida.';
  }
}

export function IsFechaNacimiento(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFechaNacimientoConstraint,
    });
  };
}