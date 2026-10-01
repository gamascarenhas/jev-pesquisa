import { z } from 'zod';

import contasJson from './fixtures/contas.json' with { type: 'json' };
import unidadesJson from './fixtures/unidades.json' with { type: 'json' };
import avaliacoesJson from './fixtures/avaliacoes.json' with { type: 'json' };
import { esquemaDeAvaliacaoBruta, paraAvaliacao, type AvaliacaoBruta } from './avaliacao-google.js';
import {
  TAMANHO_DA_PAGINA_DE_AVALIACOES,
  type ContaDoGoogle,
  type FonteDeAvaliacoes,
  type PaginaDeAvaliacoes,
  type TokensDaConexao,
  type TokensDoGoogle,
  type UnidadeDoGoogle,
} from './fonte-avaliacoes.js';

export const CODIGO_SIMULADO = 'codigo-simulado';
export const EMAIL_SIMULADO = 'conta-simulada@exemplo.com.br';
const DURACAO_DO_TOKEN_MS = 60 * 60 * 1000;
const ESCOPOS_SIMULADOS = ['https://www.googleapis.com/auth/business.manage', 'openid', 'email'];

const esquemaDeContas = z.array(z.object({ name: z.string(), accountName: z.string() }));
const esquemaDeUnidades = z.record(
  z.string(),
  z.array(z.object({ name: z.string(), title: z.string(), address: z.string().nullable() })),
);
const esquemaDeAvaliacoes = z.record(z.string(), z.array(esquemaDeAvaliacaoBruta));

export interface OpcoesDaFonteSimulada {
  uriRedirecionamento: string;
  agora?: () => Date;
  /** Avaliações por unidade; os testes trocam o conteúdo para simular edições e novas avaliações. */
  avaliacoes?: Record<string, AvaliacaoBruta[]>;
}

// Sem rede: devolve as fixtures geradas por scripts/gerar-fixtures.ts, ordenadas como o Google ordena.
export class FonteDeAvaliacoesSimulada implements FonteDeAvaliacoes {
  readonly avaliacoesPorUnidade: Record<string, AvaliacaoBruta[]>;
  readonly tokensRevogados: string[] = [];
  private readonly contas = esquemaDeContas.parse(contasJson);
  private readonly unidades = esquemaDeUnidades.parse(unidadesJson);
  private readonly agora: () => Date;

  constructor(private readonly opcoes: OpcoesDaFonteSimulada) {
    this.avaliacoesPorUnidade = opcoes.avaliacoes ?? esquemaDeAvaliacoes.parse(avaliacoesJson);
    this.agora = opcoes.agora ?? (() => new Date());
  }

  urlDeAutorizacao(state: string): string {
    const consulta = new URLSearchParams({ code: CODIGO_SIMULADO, state });
    return `${this.opcoes.uriRedirecionamento}?${consulta.toString()}`;
  }

  trocarCodigo(codigo: string): Promise<TokensDaConexao> {
    if (codigo !== CODIGO_SIMULADO) {
      return Promise.reject(new Error('codigo_invalido'));
    }
    return Promise.resolve({
      ...this.novosTokens(),
      tokenAtualizacao: 'atualizacao-simulada',
      email: EMAIL_SIMULADO,
    });
  }

  renovarToken(): Promise<TokensDoGoogle> {
    return Promise.resolve(this.novosTokens());
  }

  revogar(token: string): Promise<void> {
    this.tokensRevogados.push(token);
    return Promise.resolve();
  }

  listarContas(): Promise<ContaDoGoogle[]> {
    return Promise.resolve(this.contas.map((c) => ({ id: c.name, nome: c.accountName })));
  }

  listarUnidades(_token: string, contaId: string): Promise<UnidadeDoGoogle[]> {
    const lista = this.unidades[contaId] ?? [];
    return Promise.resolve(
      lista.map((u) => ({ nome: u.name, titulo: u.title, endereco: u.address })),
    );
  }

  listarAvaliacoes(
    _token: string,
    unidade: string,
    paginaToken: string | null,
  ): Promise<PaginaDeAvaliacoes> {
    const todas = [...(this.avaliacoesPorUnidade[unidade] ?? [])].sort((a, b) =>
      b.updateTime.localeCompare(a.updateTime),
    );
    const inicio = paginaToken === null ? 0 : Number(paginaToken);
    const fim = inicio + TAMANHO_DA_PAGINA_DE_AVALIACOES;
    return Promise.resolve({
      avaliacoes: todas.slice(inicio, fim).map(paraAvaliacao),
      proximaPagina: fim < todas.length ? String(fim) : null,
    });
  }

  private novosTokens(): TokensDoGoogle {
    return {
      tokenAcesso: 'acesso-simulado',
      expiraEm: new Date(this.agora().getTime() + DURACAO_DO_TOKEN_MS),
      escopos: ESCOPOS_SIMULADOS,
    };
  }
}

export function criarFonteDeAvaliacoesSimulada(
  opcoes: OpcoesDaFonteSimulada,
): FonteDeAvaliacoesSimulada {
  return new FonteDeAvaliacoesSimulada(opcoes);
}
