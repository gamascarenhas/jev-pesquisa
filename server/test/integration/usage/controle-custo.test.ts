import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ErroDeIaAmbiguo,
  ErroDeIaNaoCobrado,
  type ControleDeCusto,
} from '../../../src/modules/usage/controle-custo.servico.js';
import { ErroLimiteDeCustoAtingido } from '../../../src/shared/errors.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  TOKENS_DE_UMA_REQUISICAO,
  contarLivro,
  criarControleDeTeste,
  requisicaoDeTeste,
  somarLivro,
  type ControleDeTeste,
} from '../../helpers/custo.js';
import { criarContaDeTeste, criarPlanoDeTeste } from '../../helpers/factories.js';
import type { ContaId } from '../../../src/shared/ids.js';

const LIMITE_PARA_SETE_REQUISICOES = '0.070000';

describe('controle de custo', () => {
  let aplicacao: AppDeTeste;
  let teste: ControleDeTeste;
  let controle: ControleDeCusto;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
    teste = criarControleDeTeste(aplicacao.banco);
    controle = teste.controle;
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  async function criarConta(limite = LIMITE_PARA_SETE_REQUISICOES): Promise<ContaId> {
    const planoId = await criarPlanoDeTeste(aplicacao.banco, {
      limiteCustoIaUsd: limite,
      ativo: false,
    });
    return criarContaDeTeste(aplicacao.banco, { planoId });
  }

  const usoExato = { tokensEntrada: TOKENS_DE_UMA_REQUISICAO, tokensSaida: 0 };

  describe('limite com concorrência', () => {
    it('nunca ultrapassa o limite com 50 requisições concorrentes', async () => {
      const contaId = await criarConta();
      let chamadas = 0;

      const resultados = await Promise.allSettled(
        Array.from({ length: 50 }, () =>
          controle.executarComReserva(contaId, requisicaoDeTeste(), () => {
            chamadas += 1;
            return Promise.resolve({ valor: 'ok', uso: usoExato });
          }),
        ),
      );

      const recusadas = resultados.filter(
        (r) => r.status === 'rejected' && r.reason instanceof ErroLimiteDeCustoAtingido,
      );
      expect(chamadas).toBe(7);
      expect(recusadas).toHaveLength(43);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.07000000');
      expect(await contarLivro(aplicacao.banco, contaId, 'settled')).toBe(7);
      expect(await contarLivro(aplicacao.banco, contaId, 'reserved')).toBe(0);
    });

    it('lotes concorrentes reservam só o que cabe e deixam o restante como não reservado', async () => {
      const contaId = await criarConta();
      let chamadas = 0;
      const chamar = () => {
        chamadas += 1;
        return Promise.resolve({ valor: 'ok', uso: usoExato });
      };

      const lotes = await Promise.all(
        Array.from({ length: 3 }, () =>
          controle.executarEmLoteComReserva(
            contaId,
            Array.from({ length: 30 }, () => requisicaoDeTeste()),
            chamar,
            { concorrencia: 5 },
          ),
        ),
      );

      const executadas = lotes.flatMap((lote) => lote.resultados).filter((r) => r?.ok === true);
      const naoReservadas = lotes.reduce((soma, lote) => soma + lote.naoReservados.length, 0);
      expect(chamadas).toBe(7);
      expect(executadas).toHaveLength(7);
      expect(naoReservadas).toBe(90 - 7);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.07000000');
    });

    it('um lote maior que 50 é reservado em transações de até 50 requisições', async () => {
      const contaId = await criarConta('10.000000');

      const lote = await controle.executarEmLoteComReserva(
        contaId,
        Array.from({ length: 120 }, () => requisicaoDeTeste()),
        () => Promise.resolve({ valor: 1, uso: usoExato }),
      );

      expect(lote.naoReservados).toEqual([]);
      expect(lote.resultados.every((r) => r?.ok === true)).toBe(true);
      expect(await contarLivro(aplicacao.banco, contaId, 'settled')).toBe(120);
    });

    it('sem reserva a chamada não sai', async () => {
      const contaId = await criarConta('0.000001');
      let chamadas = 0;

      const unica = await controle
        .executarComReserva(contaId, requisicaoDeTeste(), () => {
          chamadas += 1;
          return Promise.resolve({ valor: 'x', uso: usoExato });
        })
        .then(
          () => undefined,
          (erro: unknown) => erro,
        );
      const lote = await controle.executarEmLoteComReserva(contaId, [requisicaoDeTeste()], () => {
        chamadas += 1;
        return Promise.resolve({ valor: 'x', uso: usoExato });
      });

      expect(unica).toBeInstanceOf(ErroLimiteDeCustoAtingido);
      expect(lote.naoReservados).toEqual([0]);
      expect(chamadas).toBe(0);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.00000000');
    });
  });

  describe('liquidação e liberação', () => {
    it('libera a reserva quando a falha é inequívoca', async () => {
      const contaId = await criarConta();

      const execucao = controle.executarComReserva(contaId, requisicaoDeTeste(), () =>
        Promise.reject(new ErroDeIaNaoCobrado()),
      );

      await expect(execucao).rejects.toBeInstanceOf(ErroDeIaNaoCobrado);
      expect(await contarLivro(aplicacao.banco, contaId, 'released')).toBe(1);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.00000000');
    });

    it('liquida pela estimativa quando o resultado é ambíguo, inclusive em falha não classificada', async () => {
      const contaId = await criarConta();

      await controle
        .executarComReserva(contaId, requisicaoDeTeste(), () =>
          Promise.reject(new ErroDeIaAmbiguo()),
        )
        .catch(() => undefined);
      await controle
        .executarComReserva(contaId, requisicaoDeTeste(), () =>
          Promise.reject(new Error('timeout')),
        )
        .catch(() => undefined);

      expect(await contarLivro(aplicacao.banco, contaId, 'settled')).toBe(2);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.02000000');
    });

    it('soma todas as tentativas conhecidas quando o SDK repetiu a chamada', async () => {
      const contaId = await criarConta('1.000000');

      await controle.executarComReserva(contaId, requisicaoDeTeste(), () =>
        Promise.resolve({ valor: 1, tentativas: 3 }),
      );
      await controle
        .executarComReserva(contaId, requisicaoDeTeste(), () =>
          Promise.reject(new ErroDeIaAmbiguo('timeout', 2)),
        )
        .catch(() => undefined);

      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.05000000');
    });

    it('liquida pelo uso real, mesmo acima da estimativa, e registra a diferença', async () => {
      const contaId = await criarConta('1.000000');

      await controle.executarComReserva(contaId, requisicaoDeTeste(), () =>
        Promise.resolve({
          valor: 1,
          uso: { tokensEntrada: TOKENS_DE_UMA_REQUISICAO + 500, tokensSaida: 7 },
        }),
      );

      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.01050000');
      const evento = teste
        .linhasDoLog()
        .find((l) => l.idReserva !== undefined && l.diferencaDeTokens === 507);
      expect(evento).toMatchObject({
        categoria: 'custo',
        tokensEstimados: TOKENS_DE_UMA_REQUISICAO,
        tokensReais: TOKENS_DE_UMA_REQUISICAO + 507,
        diferencaUsd8: '50000',
      });
      expect(teste.estimador.estatisticas().amostras).toBeGreaterThan(0);
    });

    it('guarda no livro o provedor, a operação, o modelo e as referências, sem nenhum texto', async () => {
      const contaId = await criarConta('1.000000');

      await controle.executarComReserva(
        contaId,
        requisicaoDeTeste({ provedor: 'llm', operacao: 'summarize' }),
        () => Promise.resolve({ valor: 1, uso: { tokensEntrada: 10, tokensSaida: 5 } }),
      );

      const linha = await aplicacao.banco.query(
        'SELECT provedor, operacao, modelo, tokens_entrada, tokens_saida, status FROM livro_razao_consumo WHERE conta_ref = $1',
        [contaId],
      );
      expect(linha.rows[0]).toEqual({
        provedor: 'llm',
        operacao: 'summarize',
        modelo: 'llm-teste',
        tokens_entrada: 10,
        tokens_saida: 5,
        status: 'settled',
      });
    });
  });

  describe('estimarConsumoDoPlano', () => {
    it('devolve só porcentagens do plano e se o trabalho cabe', async () => {
      const contaId = await criarConta('0.100000');
      await controle.executarComReserva(contaId, requisicaoDeTeste(), () =>
        Promise.resolve({ valor: 1, uso: usoExato }),
      );

      const cabe = await controle.estimarConsumoDoPlano(contaId, [
        requisicaoDeTeste(),
        requisicaoDeTeste(),
      ]);
      const naoCabe = await controle.estimarConsumoDoPlano(
        contaId,
        Array.from({ length: 10 }, () => requisicaoDeTeste()),
      );

      expect(cabe).toEqual({ porcentagemEstimada: 20, porcentagemJaConsumida: 10, cabe: true });
      expect(naoCabe).toEqual({
        porcentagemEstimada: 100,
        porcentagemJaConsumida: 10,
        cabe: false,
      });
      expect(Object.keys(cabe).sort()).toEqual([
        'cabe',
        'porcentagemEstimada',
        'porcentagemJaConsumida',
      ]);
    });
  });
});
