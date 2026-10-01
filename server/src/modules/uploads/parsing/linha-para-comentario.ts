import type { ComentarioParaImportar } from '../../comments/comentarios.tipos.js';
import type { CelulaBruta, Mapeamento } from '../envios.tipos.js';
import { interpretarData } from './interpretar-data.js';

const MINIMO_DE_CARACTERES_UTEIS = 3;
const TAMANHO_MAXIMO_DE_ROTULO = 200;
const NOTA_MINIMA = 1;
const NOTA_MAXIMA = 5;
const REGEX_CARACTERE_UTIL = /[\p{L}\p{N}]/gu;
const REGEX_NUMERO = /\d+(?:[.,]\d+)?/;

export type ResultadoDaLinha =
  { ignorada: true } | { ignorada: false; comentario: ComentarioParaImportar };

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function celulaParaTexto(celula: CelulaBruta | undefined): string {
  if (celula === null || celula === undefined) {
    return '';
  }
  if (celula instanceof Date) {
    const dia = doisDigitos(celula.getUTCDate());
    const mes = doisDigitos(celula.getUTCMonth() + 1);
    return `${dia}/${mes}/${String(celula.getUTCFullYear())}`;
  }
  return String(celula).trim();
}

function interpretarNota(celula: CelulaBruta | undefined): number | null {
  const numero = REGEX_NUMERO.exec(celulaParaTexto(celula))?.[0];
  if (numero === undefined) {
    return null;
  }
  const nota = Math.round(Number(numero.replace(',', '.')));
  return nota >= NOTA_MINIMA && nota <= NOTA_MAXIMA ? nota : null;
}

function rotuloOpcional(celula: CelulaBruta | undefined): string | null {
  const texto = celulaParaTexto(celula).slice(0, TAMANHO_MAXIMO_DE_ROTULO);
  return texto === '' ? null : texto;
}

function celulaDaColuna(
  celulas: CelulaBruta[],
  coluna: number | undefined,
): CelulaBruta | undefined {
  return coluna === undefined ? undefined : celulas[coluna];
}

export function transformarLinha(celulas: CelulaBruta[], mapeamento: Mapeamento): ResultadoDaLinha {
  const texto = celulaParaTexto(celulas[mapeamento.comentario]);
  if ((texto.match(REGEX_CARACTERE_UTIL)?.length ?? 0) < MINIMO_DE_CARACTERES_UTEIS) {
    return { ignorada: true };
  }
  return {
    ignorada: false,
    comentario: {
      texto,
      nota: interpretarNota(celulaDaColuna(celulas, mapeamento.nota)),
      unidade: rotuloOpcional(celulaDaColuna(celulas, mapeamento.unidade)),
      autor: rotuloOpcional(celulaDaColuna(celulas, mapeamento.autor)),
      comentadoEm: interpretarData(celulaDaColuna(celulas, mapeamento.data) ?? null),
    },
  };
}
