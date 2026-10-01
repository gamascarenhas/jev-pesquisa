import type { CelulaBruta, TipoDeArquivo } from '../envios.tipos.js';
import { lerLinhasCsv } from './leitor-csv.js';
import { lerLinhasXlsx } from './leitor-xlsx.js';

export function abrirLinhas(
  caminho: string,
  tipo: TipoDeArquivo,
  aba?: string,
): AsyncGenerator<CelulaBruta[]> {
  return tipo === 'csv' ? lerLinhasCsv(caminho) : lerLinhasXlsx(caminho, aba);
}
