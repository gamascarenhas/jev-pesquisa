import { readFile } from 'node:fs/promises';

import Papa from 'papaparse';

import type { CelulaBruta } from '../envios.tipos.js';
import { erroLimiteDeLinhas } from '../erros-envio.js';
import { LIMITE_LINHAS_ENVIO } from '../limites-envio.js';
import { decodificarTexto } from './detectar-codificacao.js';
import { detectarSeparador } from './detectar-separador.js';

// A primeira linha é o cabeçalho; o limite vale para as linhas de dados.
export async function* lerLinhasCsv(caminho: string): AsyncGenerator<CelulaBruta[]> {
  const { texto } = decodificarTexto(await readFile(caminho));
  const { data } = Papa.parse<string[]>(texto, {
    delimiter: detectarSeparador(texto),
    skipEmptyLines: 'greedy',
  });
  for (const [indice, linha] of data.entries()) {
    if (indice > LIMITE_LINHAS_ENVIO) {
      throw erroLimiteDeLinhas();
    }
    yield linha;
  }
}
