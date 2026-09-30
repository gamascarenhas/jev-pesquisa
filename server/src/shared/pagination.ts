import { z } from 'zod';

export const TAMANHO_PAGINA_PADRAO = 20;
export const TAMANHO_PAGINA_MAXIMO = 100;

export const esquemaPaginacao = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    tamanhoPagina: z.coerce
      .number()
      .int()
      .min(1)
      .max(TAMANHO_PAGINA_MAXIMO)
      .default(TAMANHO_PAGINA_PADRAO),
  })
  .strict();

export type EntradaPaginacao = z.infer<typeof esquemaPaginacao>;

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export function calcularDeslocamento(entrada: EntradaPaginacao): number {
  return (entrada.pagina - 1) * entrada.tamanhoPagina;
}

export function montarPagina<T>(itens: T[], total: number, entrada: EntradaPaginacao): Pagina<T> {
  return { itens, total, pagina: entrada.pagina, tamanhoPagina: entrada.tamanhoPagina };
}
