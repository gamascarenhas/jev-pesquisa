import type { Agregados } from './resumos.tipos.js';

export const TOLERANCIA_DE_ARREDONDAMENTO = 1;

const REGEX_NUMERO = /\d+(?:[.,]\d+)?/g;
const REGEX_IDENTIFICADOR = /\bc\d+\b/gi;

export function extrairNumeros(texto: string): number[] {
  const semIdentificadores = texto.replace(REGEX_IDENTIFICADOR, ' ');
  return (semIdentificadores.match(REGEX_NUMERO) ?? []).map((n) => Number(n.replace(',', '.')));
}

function folhasNumericas(valor: unknown): number[] {
  if (typeof valor === 'number') {
    return [Math.abs(valor)];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap(folhasNumericas);
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.values(valor).flatMap(folhasNumericas);
  }
  return [];
}

// Uma queda de 12% pode ser escrita como "caiu 12%": o sinal não conta.
export function numerosPermitidos(agregados: Agregados): number[] {
  return folhasNumericas(agregados);
}

export function numerosInventados(textos: string[], agregados: Agregados): number[] {
  const permitidos = numerosPermitidos(agregados);
  return textos
    .flatMap(extrairNumeros)
    .filter((n) => !permitidos.some((p) => Math.abs(p - n) <= TOLERANCIA_DE_ARREDONDAMENTO));
}
