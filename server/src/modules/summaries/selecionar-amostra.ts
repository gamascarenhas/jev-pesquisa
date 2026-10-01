import type { CandidatoDoResumo } from '../comments/comentarios.servico.js';
import type { AmostraDoResumo, UnidadePrincipal } from './resumos.tipos.js';

export const TAMANHO_MAXIMO_DA_AMOSTRA = 20;
export const MAXIMO_POR_GRAVIDADE = 8;
export const MAXIMO_RECENTES = 6;
export const CONFIANCA_MINIMA_DO_TEMA = 0.7;
export const MAX_CARACTERES_DO_COMENTARIO = 600;
const SEMENTE_FIXA = 20_260_511;

// Gerador pseudoaleatório com semente: o mesmo conjunto de dados escolhe sempre a mesma amostra.
function criarSorteio(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function semQuaseDuplicados(candidatos: CandidatoDoResumo[]): CandidatoDoResumo[] {
  const vistos = new Set<string>();
  return candidatos.filter((c) => {
    const chave = normalizar(c.textoMascarado);
    if (chave === '' || vistos.has(chave)) {
      return false;
    }
    vistos.add(chave);
    return true;
  });
}

function maisRecentesPrimeiro(a: CandidatoDoResumo, b: CandidatoDoResumo): number {
  return (b.comentadoEm?.getTime() ?? -Infinity) - (a.comentadoEm?.getTime() ?? -Infinity);
}

function embaralhar<T>(lista: T[], sorteio: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

// A regra da spec, em ordem: gravidade, recentes, uma por unidade principal e sorteio com semente fixa.
export function selecionarAmostra(
  todos: CandidatoDoResumo[],
  unidadesPrincipais: UnidadePrincipal[],
): AmostraDoResumo[] {
  const candidatos = semQuaseDuplicados(todos);
  const escolhidos = new Map<string, CandidatoDoResumo>();
  const adicionar = (lista: CandidatoDoResumo[], limite: number): void => {
    for (const c of lista) {
      if (limite <= 0 || escolhidos.size >= TAMANHO_MAXIMO_DA_AMOSTRA) {
        return;
      }
      if (!escolhidos.has(c.id)) {
        escolhidos.set(c.id, c);
        limite -= 1;
      }
    }
  };
  const graves = candidatos
    .filter((c) => c.confiancaDoTema > CONFIANCA_MINIMA_DO_TEMA)
    .sort((a, b) => b.gravidade - a.gravidade || a.id.localeCompare(b.id));
  adicionar(graves, MAXIMO_POR_GRAVIDADE);
  const recentes = [...candidatos].sort(maisRecentesPrimeiro);
  adicionar(recentes, MAXIMO_RECENTES);
  for (const { unidade } of unidadesPrincipais) {
    const jaTem = [...escolhidos.values()].some((c) => c.unidade === unidade);
    if (!jaTem) {
      adicionar(
        recentes.filter((c) => c.unidade === unidade),
        1,
      );
    }
  }
  adicionar(embaralhar(candidatos, criarSorteio(SEMENTE_FIXA)), TAMANHO_MAXIMO_DA_AMOSTRA);
  return [...escolhidos.values()].map((c, indice) => ({
    id: `c${String(indice + 1)}`,
    comentarioId: c.id,
    texto: c.textoMascarado.slice(0, MAX_CARACTERES_DO_COMENTARIO),
  }));
}
