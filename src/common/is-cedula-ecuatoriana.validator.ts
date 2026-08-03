import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isCedulaEcuatoriana', async: false })
export class IsCedulaEcuatorianaConstraint implements ValidatorConstraintInterface {
    validate(cedula: string, args: ValidationArguments) {
        if (!cedula || cedula.length !== 10) return false;

        // Los dos primeros dígitos corresponden al código de la provincia (01 a 24) o 30 (extranjeros en registro civil)
        const provincia = parseInt(cedula.substring(0, 2), 10);
        if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

        // El tercer dígito es menor a 6 para personas naturales
        const tercerDigito = parseInt(cedula[2], 10);
        if (tercerDigito >= 6) return false;

        // Coeficientes de validación
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;

        for (let i = 0; i < 9; i++) {
            let valor = parseInt(cedula[i], 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }

        const digitoVerificador = parseInt(cedula[9], 10);
        const decenaSuperior = Math.ceil(suma / 10) * 10;
        let resultado = decenaSuperior - suma;

        if (resultado === 10) resultado = 0;

        return resultado === digitoVerificador;
    }

    defaultMessage(args: ValidationArguments) {
        return 'La cédula ingresada no es una cédula ecuatoriana válida.';
    }
}

export function IsCedulaEcuatoriana(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsCedulaEcuatorianaConstraint,
        });
    };
}