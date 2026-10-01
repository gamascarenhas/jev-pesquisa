import type { AgregadoDoTema } from '../comments/comentarios.servico.js';
import type { Agregados, Variacoes } from './resumos.tipos.js';

const CASAS = 10;
const PERCENTUAL = 100;

function arredondar(valor: number): number {
  return Math.round(valor * CASAS) / CASAS;
}

function porcentagem(parte: number, total: number): number {
  return total === 0 ? 0 : arredondar((parte / total) * PERCENTUAL);
}

function crescimento(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : arredondar(((atual - anterior) / anterior) * PERCENTUAL);
}

function calcularVariacoes(
  atual: Agregados,
  anterior: NonNullable<Agregados['anterior']>,
): Variacoes {
  return {
    volume: crescimento(atual.volume, anterior.volume),
    negativos: crescimento(atual.negativos, anterior.negativos),
    percentualNegativo: arredondar(atual.percentualNegativo - anterior.percentualNegativo),
  };
}

// Toda conta do resumo é feita aqui, no código; o LLM só recebe o resultado.
// Sem período anterior comparável (`anterior` nulo ou vazio), o resumo traz só os totais.
export function agregar(atual: AgregadoDoTema, anterior: AgregadoDoTema | null): Agregados {
  const base: Agregados = {
    volume: atual.volume,
    negativos: atual.negativos,
    percentualNegativo: porcentagem(atual.negativos, atual.volume),
    gravidadeMedia:
      atual.volume === 0 ? 0 : Math.round((atual.somaDaGravidade / atual.volume) * 100) / 100,
    percentualPrecisaAcao: porcentagem(atual.precisamDeAcao, atual.volume),
    unidadesPrincipais: atual.unidadesPrincipais.map((u) => ({
      unidade: u.unidade,
      total: u.total,
      participacao: porcentagem(u.total, atual.volume),
    })),
    anterior: null,
    variacoes: null,
  };
  if (anterior === null || anterior.volume === 0) {
    return base;
  }
  const resumoAnterior = {
    volume: anterior.volume,
    negativos: anterior.negativos,
    percentualNegativo: porcentagem(anterior.negativos, anterior.volume),
  };
  return { ...base, anterior: resumoAnterior, variacoes: calcularVariacoes(base, resumoAnterior) };
}
