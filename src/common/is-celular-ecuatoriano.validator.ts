import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

// Valida números celulares ecuatorianos: 10 dígitos, empezando en "09" (ej. 0991234567)
@ValidatorConstraint({ name: 'isCelularEcuatoriano', async: false })
export class IsCelularEcuatorianoConstraint implements ValidatorConstraintInterface {
  validate(celular: string, args: ValidationArguments) {
    if (!celular || typeof celular !== 'string') return false;
    return /^09\d{8}$/.test(celular.trim());
  }

  defaultMessage(args: ValidationArguments) {
    return 'El número celular debe tener 10 dígitos y empezar con 09 (ej. 0991234567).';
  }
}

export function IsCelularEcuatoriano(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCelularEcuatorianoConstraint,
    });
  };
}