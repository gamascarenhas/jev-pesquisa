import Papa from 'papaparse';

export type Separador = ';' | ',';

const TAMANHO_DA_AMOSTRA = 65_536;
const LINHAS_DA_AMOSTRA = 10;

function pontuar(amostra: string, separador: Separador): number {
  const { data } = Papa.parse<string[]>(amostra, {
    delimiter: separador,
    preview: LINHAS_DA_AMOSTRA,
    skipEmptyLines: 'greedy',
  });
  const colunas = data[0]?.length ?? 0;
  if (colunas < 2) {
    return 0;
  }
  const consistentes = data.filter((linha) => linha.length === colunas).length;
  return consistentes * 1000 + colunas;
}

// Vírgula decimal ("4,5") em arquivo com ";" deixa a vírgula inconsistente entre linhas e perde a disputa.
export function detectarSeparador(texto: string): Separador {
  const amostra = texto.slice(0, TAMANHO_DA_AMOSTRA);
  return pontuar(amostra, ';') >= pontuar(amostra, ',') ? ';' : ',';
}
