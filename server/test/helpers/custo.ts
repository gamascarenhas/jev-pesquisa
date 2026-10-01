import type { Banco } from '../../src/db/conexoes.js';
import { criarConsumoRepositorio } from '../../src/modules/usage/consumo.repositorio.js';
import { criarConsumoSistemaRepositorio } from '../../src/modules/usage/consumo.sistema.repositorio.js';
import {
  criarControleDeCusto,
  type ControleDeCusto,
  type RequisicaoDeIa,
} from '../../src/modules/usage/controle-custo.servico.js';
import {
  criarEstimadorDeCusto,
  type EstimadorDeCusto,
} from '../../src/modules/usage/estimador-custo.js';
import { criarFilaTrabalhos } from '../../src/jobs/fila-trabalhos.js';
import { relogioDoSistema, type Relogio } from '../../src/shared/clock.js';
import type { Registrador } from '../../src/shared/logger.js';
import { criarRegistradorCapturado } from './factories.js';

// 1 USD por milhão de tokens: cada token custa 100 unidades de 1e-8 USD.
export const PRECO_DE_TESTE_POR_MTOK = 100_000_000n;
export const CARACTERES_DE_UMA_REQUISICAO = 40_000;
export const TOKENS_DE_UMA_REQUISICAO = 10_000;
// 10.000 tokens a 1 USD por milhão = 0,01 USD.
export const CUSTO_DE_UMA_REQUISICAO_USD = '0.01000000';

export interface ControleDeTeste {
  controle: ControleDeCusto;
  estimador: EstimadorDeCusto;
  registrador: Registrador;
  linhasDoLog: () => Record<string, unknown>[];
}

export function criarControleDeTeste(
  banco: Banco,
  relogio: Relogio = relogioDoSistema,
): ControleDeTeste {
  const captura = criarRegistradorCapturado();
  const estimador = criarEstimadorDeCusto({
    precos: {
      jev: PRECO_DE_TESTE_POR_MTOK,
      llmEntrada: PRECO_DE_TESTE_POR_MTOK,
      llmSaida: PRECO_DE_TESTE_POR_MTOK * 5n,
    },
    tokensSaidaDoLlm: 1_200,
  });
  const fila = criarFilaTrabalhos(banco);
  const controle = criarControleDeCusto({
    consumo: criarConsumoRepositorio(banco),
    sistema: criarConsumoSistemaRepositorio(banco),
    estimador,
    relogio,
    registrador: captura.registrador,
    retomarJob: (id, agora) => fila.retomarPausado(id, agora),
    modeloDoJev: 'jev-teste',
    modeloDoLlm: 'llm-teste',
  });
  return { controle, estimador, registrador: captura.registrador, linhasDoLog: captura.linhas };
}

export function requisicaoDeTeste(sobrescritas: Partial<RequisicaoDeIa> = {}): RequisicaoDeIa {
  return {
    provedor: 'jev',
    operacao: 'classify',
    caracteresEntrada: CARACTERES_DE_UMA_REQUISICAO,
    ...sobrescritas,
  };
}

export async function somarLivro(
  banco: Banco,
  contaId: string,
  status?: 'reserved' | 'settled' | 'released',
): Promise<string> {
  const resultado = await banco.query<{ total: string }>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN real_usd
                              WHEN status = 'reserved' THEN reservado_usd END), 0)::numeric(14,8)::text AS total
       FROM livro_razao_consumo
      WHERE conta_ref = $1 AND ($2::text IS NULL OR status = $2)`,
    [contaId, status ?? null],
  );
  return resultado.rows[0]?.total ?? '0';
}

export async function contarLivro(
  banco: Banco,
  contaId: string,
  status: 'reserved' | 'settled' | 'released',
): Promise<number> {
  const resultado = await banco.query<{ total: string }>(
    'SELECT count(*) AS total FROM livro_razao_consumo WHERE conta_ref = $1 AND status = $2',
    [contaId, status],
  );
  return Number(resultado.rows[0]?.total);
}
