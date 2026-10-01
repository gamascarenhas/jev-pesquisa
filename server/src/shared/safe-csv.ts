export type CelulaDeCsv = string | number | boolean | null | undefined;

const SEPARADOR = ';';
const BOM = '﻿';
const INICIOS_DE_FORMULA = ['=', '+', '-', '@', '\t', '\r'];
const PRECISA_DE_ASPAS = /[;"\r\n]/;

// O Excel executa como fórmula o texto que começa com estes caracteres; a aspa simples o mantém como texto.
export function neutralizarFormula(texto: string): string {
  return INICIOS_DE_FORMULA.some((inicio) => texto.startsWith(inicio)) ? `'${texto}` : texto;
}

function formatarNumero(valor: number): string {
  return String(valor).replace('.', ',');
}

function formatarCelula(celula: CelulaDeCsv): string {
  if (celula === null || celula === undefined) {
    return '';
  }
  if (typeof celula === 'number') {
    return formatarNumero(celula);
  }
  const texto = typeof celula === 'boolean' ? (celula ? 'Sim' : 'Não') : neutralizarFormula(celula);
  return PRECISA_DE_ASPAS.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function montarLinhaDeCsv(celulas: CelulaDeCsv[]): string {
  return `${celulas.map(formatarCelula).join(SEPARADOR)}\r\n`;
}

// UTF-8 com BOM e ";" para o Excel em português abrir o arquivo direto, com os acentos corretos.
export function iniciarCsv(cabecalho: string[]): string {
  return `${BOM}${montarLinhaDeCsv(cabecalho)}`;
}
