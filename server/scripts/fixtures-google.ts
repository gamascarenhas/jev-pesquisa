import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AvaliacaoBruta } from '../src/integrations/google/avaliacao-google.js';
import { gerarComentariosDeDemonstracao } from './dados-demonstracao.js';

export const SEMENTE_DO_GOOGLE = 20_260_303;
export const QUANTIDADE_DE_AVALIACOES = 200;
const DIRETORIO_DAS_FIXTURES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/integrations/google/fixtures',
);
const ESTRELAS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'] as const;
const MS_POR_HORA = 3_600_000;
const A_CADA_SEM_COMENTARIO = 7;
const A_CADA_COMENTARIO_LONGO = 23;
const A_CADA_EDITADA = 11;
const A_CADA_ANONIMA = 13;
const REPETICOES_DO_COMENTARIO_LONGO = 12;

export const CONTAS_DO_GOOGLE = [
  { name: 'accounts/1000000001', accountName: 'Rede Exemplo Alimentos' },
  { name: 'accounts/1000000002', accountName: 'Padaria Exemplo' },
];

export const UNIDADES_DO_GOOGLE: Record<
  string,
  { name: string; title: string; address: string | null }[]
> = {
  'accounts/1000000001': [
    {
      name: 'accounts/1000000001/locations/2000000001',
      title: 'Rede Exemplo - Centro',
      address: 'Rua das Flores, 100, São Paulo',
    },
    {
      name: 'accounts/1000000001/locations/2000000002',
      title: 'Rede Exemplo - Zona Sul',
      address: 'Avenida Brasil, 2000, São Paulo',
    },
    {
      name: 'accounts/1000000001/locations/2000000003',
      title: 'Rede Exemplo - Aeroporto',
      address: null,
    },
  ],
  'accounts/1000000002': [
    {
      name: 'accounts/1000000002/locations/2000000004',
      title: 'Padaria Exemplo - Matriz',
      address: 'Praça da Sé, 1, São Paulo',
    },
  ],
};

// A primeira unidade recebe metade das avaliações, para exercitar a paginação de 50 em 50.
const DISTRIBUICAO_POR_UNIDADE = [0, 0, 0, 1, 2, 3];
const INICIO_DAS_AVALIACOES = Date.UTC(2025, 5, 1);

function montarAvaliacao(
  item: { texto: string; nota: number | null; autor: string | null },
  indice: number,
): AvaliacaoBruta {
  const criada = INICIO_DAS_AVALIACOES + indice * 30 * MS_POR_HORA;
  const editada = indice % A_CADA_EDITADA === 0;
  const longo = indice % A_CADA_COMENTARIO_LONGO === 0;
  const comentario = longo
    ? Array.from({ length: REPETICOES_DO_COMENTARIO_LONGO }, () => item.texto).join(' ')
    : item.texto;
  const reviewer =
    indice % A_CADA_ANONIMA === 0
      ? { isAnonymous: true }
      : { displayName: item.autor ?? 'Cliente', isAnonymous: false };
  return {
    reviewId: `AbFvOq${String(indice + 1).padStart(6, '0')}`,
    starRating: ESTRELAS[(item.nota ?? 1) - 1] ?? 'ONE',
    createTime: new Date(criada).toISOString(),
    updateTime: new Date(criada + (editada ? 72 * MS_POR_HORA : 0)).toISOString(),
    reviewer,
    ...(indice % A_CADA_SEM_COMENTARIO === 0 ? {} : { comment: comentario }),
  };
}

// Mesma semente, mesmas avaliações: o conteúdo nunca depende do dia nem da máquina.
export function gerarAvaliacoesDoGoogle(): Record<string, AvaliacaoBruta[]> {
  const unidades = Object.values(UNIDADES_DO_GOOGLE).flat();
  const textos = gerarComentariosDeDemonstracao(QUANTIDADE_DE_AVALIACOES, {
    semente: SEMENTE_DO_GOOGLE,
    chanceDeDadoPessoal: 0,
    numerar: true,
  });
  const resultado: Record<string, AvaliacaoBruta[]> = {};
  textos.forEach((item, indice) => {
    const posicao = DISTRIBUICAO_POR_UNIDADE[indice % DISTRIBUICAO_POR_UNIDADE.length] ?? 0;
    const unidade = unidades[posicao];
    if (unidade !== undefined) {
      (resultado[unidade.name] ??= []).push(montarAvaliacao(item, indice));
    }
  });
  return resultado;
}

export async function gravarFixturesDoGoogle(): Promise<void> {
  await mkdir(DIRETORIO_DAS_FIXTURES, { recursive: true });
  const arquivos = {
    'contas.json': CONTAS_DO_GOOGLE,
    'unidades.json': UNIDADES_DO_GOOGLE,
    'avaliacoes.json': gerarAvaliacoesDoGoogle(),
  };
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    await writeFile(
      resolve(DIRETORIO_DAS_FIXTURES, nome),
      `${JSON.stringify(conteudo, null, 2)}\n`,
      'utf8',
    );
  }
}
