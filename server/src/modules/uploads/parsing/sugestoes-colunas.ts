import type { Mapeamento } from '../envios.tipos.js';

type CampoSugerivel = keyof Mapeamento;

const SINONIMOS: Record<CampoSugerivel, string[]> = {
  comentario: [
    'comentario',
    'comment',
    'feedback',
    'observacao',
    'avaliacao',
    'review',
    'opiniao',
    'mensagem',
    'texto',
  ],
  data: ['data', 'date', 'criado em', 'datetime', 'quando'],
  nota: ['nota', 'rating', 'estrelas', 'stars', 'score', 'pontuacao'],
  unidade: ['unidade', 'local', 'loja', 'filial', 'location', 'store', 'agencia'],
  autor: ['autor', 'author', 'cliente', 'usuario', 'nome', 'customer'],
};

const ORDEM_DE_PREENCHIMENTO: CampoSugerivel[] = ['comentario', 'data', 'nota', 'unidade', 'autor'];

function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function acharColuna(
  cabecalho: string[],
  sinonimos: string[],
  usadas: Set<number>,
): number | undefined {
  const normalizados = cabecalho.map(normalizar);
  const exata = normalizados.findIndex(
    (nome, indice) => !usadas.has(indice) && sinonimos.includes(nome),
  );
  if (exata >= 0) {
    return exata;
  }
  const parcial = normalizados.findIndex(
    (nome, indice) => !usadas.has(indice) && sinonimos.some((sinonimo) => nome.includes(sinonimo)),
  );
  return parcial >= 0 ? parcial : undefined;
}

export function sugerirMapeamento(cabecalho: string[]): Partial<Mapeamento> {
  const usadas = new Set<number>();
  const sugestao: Partial<Mapeamento> = {};
  for (const campo of ORDEM_DE_PREENCHIMENTO) {
    const coluna = acharColuna(cabecalho, SINONIMOS[campo], usadas);
    if (coluna !== undefined) {
      sugestao[campo] = coluna;
      usadas.add(coluna);
    }
  }
  return sugestao;
}
