import type { Banco, Executor } from '../../db/conexoes.js';
import { comTransacao } from '../../db/transacao.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId } from '../../shared/ids.js';
import type { OperacaoDeIa, ProvedorDeIa, ReferenciasDaReserva } from './consumo.tipos.js';
import { unidadesParaUsdTexto, usdTextoParaUnidades, type UnidadesUsd } from './valores-usd.js';

export interface ItemParaReservar extends ReferenciasDaReserva {
  provedor: ProvedorDeIa;
  operacao: OperacaoDeIa;
  modelo: string | undefined;
  tokensEntradaEstimados: number;
  tokensSaidaEstimados: number;
  reservadoUsd8: UnidadesUsd;
}

export interface ReservaGravada {
  id: string;
  item: ItemParaReservar;
}

export interface ConsumoDoCiclo {
  consumidoUsd8: UnidadesUsd;
  limiteUsd8: UnidadesUsd;
}

export interface SituacaoDoConsumo extends ConsumoDoCiclo {
  nomeDaConta: string;
  cicloTerminaEm: Date;
}

export interface LiquidacaoDaReserva {
  tokensEntrada: number;
  tokensSaida: number;
  realUsd8: UnidadesUsd;
}

interface LinhaDaConta {
  limite: string;
}

interface LinhaDeSoma {
  consumido: string;
}

// O ciclo é comparado no próprio SQL: um Date do JavaScript perde os microssegundos e nunca igualaria o da conta.
const SOMA_DO_CONSUMO = `
  SELECT COALESCE(SUM(CASE l.status WHEN 'settled' THEN l.real_usd WHEN 'reserved' THEN l.reservado_usd END), 0)::text
         AS consumido
    FROM livro_razao_consumo l
   WHERE l.conta_ref = $1
     AND l.ciclo_iniciado_em = (SELECT ciclo_iniciado_em FROM contas WHERE id = $1)`;

const CONTA_E_LIMITE = `
  SELECT p.limite_custo_ia_usd::text AS limite
    FROM contas c JOIN planos p ON p.id = c.plano_id
   WHERE c.id = $1`;

function contaNaoEncontrada(): ErroNaoEncontrado {
  return new ErroNaoEncontrado('Conta não encontrada.', 'conta_nao_encontrada');
}

async function somarConsumo(executor: Executor, contaId: ContaId): Promise<bigint> {
  const soma = await executor.query<LinhaDeSoma>(SOMA_DO_CONSUMO, [contaId]);
  return usdTextoParaUnidades(soma.rows[0]?.consumido ?? '0');
}

export class ConsumoRepositorio {
  constructor(private readonly banco: Banco) {}

  async consumoDoCiclo(contaId: ContaId): Promise<ConsumoDoCiclo> {
    const conta = await this.banco.query<LinhaDaConta>(CONTA_E_LIMITE, [contaId]);
    const linha = conta.rows[0];
    if (linha === undefined) {
      throw contaNaoEncontrada();
    }
    return {
      consumidoUsd8: await somarConsumo(this.banco, contaId),
      limiteUsd8: usdTextoParaUnidades(linha.limite),
    };
  }

  async situacaoDoConsumo(contaId: ContaId): Promise<SituacaoDoConsumo> {
    const conta = await this.banco.query<{ nome: string; termina: Date; limite: string }>(
      `SELECT c.nome, c.ciclo_termina_em AS termina, p.limite_custo_ia_usd::text AS limite
         FROM contas c JOIN planos p ON p.id = c.plano_id WHERE c.id = $1`,
      [contaId],
    );
    const linha = conta.rows[0];
    if (linha === undefined) {
      throw contaNaoEncontrada();
    }
    return {
      nomeDaConta: linha.nome,
      cicloTerminaEm: linha.termina,
      consumidoUsd8: await somarConsumo(this.banco, contaId),
      limiteUsd8: usdTextoParaUnidades(linha.limite),
    };
  }

  // O ciclo vem da própria conta no SQL; a chave primária garante um aviso por limiar em cada ciclo.
  async registrarAlerta(contaId: ContaId, limiar: number): Promise<boolean> {
    const resultado = await this.banco.query(
      `INSERT INTO alertas_consumo (conta_id, ciclo_iniciado_em, limiar)
       SELECT id, ciclo_iniciado_em, $2 FROM contas WHERE id = $1
       ON CONFLICT DO NOTHING`,
      [contaId, limiar],
    );
    return resultado.rowCount === 1;
  }

  async vencerCicloAgora(contaId: ContaId, agora: Date): Promise<void> {
    await this.banco.query(
      'UPDATE contas SET ciclo_termina_em = $2::timestamptz WHERE id = $1 AND ciclo_iniciado_em < $2::timestamptz',
      [contaId, agora],
    );
  }

  // Só avança se o ciclo ainda estiver vencido: duas instâncias nunca viram o mesmo ciclo duas vezes.
  async avancarCiclo(contaId: ContaId, agora: Date): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE contas
          SET ciclo_iniciado_em = $2::timestamptz, ciclo_termina_em = $2::timestamptz + interval '1 month',
              atualizado_em = $2::timestamptz
        WHERE id = $1 AND ciclo_termina_em <= $2::timestamptz`,
      [contaId, agora],
    );
    return resultado.rowCount === 1;
  }

  // O bloqueio da linha da conta serializa as reservas: requisições paralelas nunca passam do limite juntas.
  async reservarLote(contaId: ContaId, itens: ItemParaReservar[]): Promise<ReservaGravada[]> {
    return comTransacao(this.banco, async (cliente) => {
      const conta = await cliente.query<LinhaDaConta>(`${CONTA_E_LIMITE} FOR UPDATE OF c`, [
        contaId,
      ]);
      const linha = conta.rows[0];
      if (linha === undefined) {
        throw contaNaoEncontrada();
      }
      const limite = usdTextoParaUnidades(linha.limite);
      let acumulado = await somarConsumo(cliente, contaId);
      const cabem: ItemParaReservar[] = [];
      for (const item of itens) {
        if (acumulado + item.reservadoUsd8 > limite) {
          break;
        }
        acumulado += item.reservadoUsd8;
        cabem.push(item);
      }
      return this.inserir(cliente, contaId, cabem);
    });
  }

  async liquidar(
    contaId: ContaId,
    reservaId: string,
    liquidacao: LiquidacaoDaReserva,
    agora: Date,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE livro_razao_consumo
          SET status = 'settled', tokens_entrada = $3, tokens_saida = $4, real_usd = $5::numeric,
              finalizado_em = $6
        WHERE conta_ref = $1 AND id = $2 AND status = 'reserved'`,
      [
        contaId,
        reservaId,
        liquidacao.tokensEntrada,
        liquidacao.tokensSaida,
        unidadesParaUsdTexto(liquidacao.realUsd8),
        agora,
      ],
    );
    return resultado.rowCount === 1;
  }

  async liberar(contaId: ContaId, reservaId: string, agora: Date): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE livro_razao_consumo SET status = 'released', finalizado_em = $3
        WHERE conta_ref = $1 AND id = $2 AND status = 'reserved'`,
      [contaId, reservaId, agora],
    );
    return resultado.rowCount === 1;
  }

  private async inserir(
    cliente: Executor,
    contaId: ContaId,
    itens: ItemParaReservar[],
  ): Promise<ReservaGravada[]> {
    if (itens.length === 0) {
      return [];
    }
    const resultado = await cliente.query<{ id: string }>(
      `INSERT INTO livro_razao_consumo
         (conta_id, conta_ref, ciclo_iniciado_em, provedor, operacao, comentario_ref,
          pergunta_personalizada_ref, resumo_ref, modelo, tokens_entrada_estimados,
          tokens_saida_estimados, reservado_usd)
       SELECT c.id, c.id, c.ciclo_iniciado_em, t.provedor, t.operacao, t.comentario, t.pergunta, t.resumo, t.modelo,
              t.entrada, t.saida, t.reservado
         FROM contas c CROSS JOIN unnest($2::text[], $3::text[], $4::uuid[], $5::uuid[], $6::uuid[], $7::text[],
                     $8::integer[], $9::integer[], $10::numeric[])
              AS t(provedor, operacao, comentario, pergunta, resumo, modelo, entrada, saida, reservado)
        WHERE c.id = $1
       RETURNING id::text`,
      [
        contaId,
        itens.map((item) => item.provedor),
        itens.map((item) => item.operacao),
        itens.map((item) => item.comentarioRef ?? null),
        itens.map((item) => item.perguntaPersonalizadaRef ?? null),
        itens.map((item) => item.resumoRef ?? null),
        itens.map((item) => item.modelo ?? null),
        itens.map((item) => item.tokensEntradaEstimados),
        itens.map((item) => item.tokensSaidaEstimados),
        itens.map((item) => unidadesParaUsdTexto(item.reservadoUsd8)),
      ],
    );
    // O identificador é sequencial: em ordem crescente, alinha com a ordem dos itens inseridos.
    const ids = resultado.rows.map((linha) => BigInt(linha.id)).sort((a, b) => (a < b ? -1 : 1));
    return itens.map((item, indice) => ({ id: String(ids[indice]), item }));
  }
}

export function criarConsumoRepositorio(banco: Banco): ConsumoRepositorio {
  return new ConsumoRepositorio(banco);
}
