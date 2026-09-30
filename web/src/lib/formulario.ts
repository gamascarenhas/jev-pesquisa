import type { SubmitEvent } from 'react';
import type { ZodType } from 'zod';

export type ErrosDoFormulario = Record<string, string>;

export type ResultadoDaValidacao<T> =
  { dados: T; erros?: undefined } | { dados?: undefined; erros: ErrosDoFormulario };

export function lerCampos(
  evento: SubmitEvent<HTMLFormElement>,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(new FormData(evento.currentTarget));
}

export function validar<T>(esquema: ZodType<T>, valores: unknown): ResultadoDaValidacao<T> {
  const resultado = esquema.safeParse(valores);
  if (resultado.success) {
    return { dados: resultado.data };
  }
  const erros: ErrosDoFormulario = {};
  for (const problema of resultado.error.issues) {
    const campo = String(problema.path[0] ?? '');
    erros[campo] ??= problema.message;
  }
  return { erros };
}
