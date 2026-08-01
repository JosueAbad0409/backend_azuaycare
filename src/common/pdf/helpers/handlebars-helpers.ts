import * as Handlebars from 'handlebars';

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('formatDate', (fecha: string | Date) =>
    fecha ? new Date(fecha).toLocaleDateString('es-ES') : 'N/A',
  );

  Handlebars.registerHelper('formatCurrency', (valor: number) =>
    `$${Number(valor ?? 0).toFixed(2)}`,
  );

  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
}