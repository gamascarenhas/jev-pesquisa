import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  criarExecutorTrabalhos,
  type ExecutorTrabalhos,
} from '../../../src/jobs/executor-trabalhos.js';
import { criarFilaTrabalhos } from '../../../src/jobs/fila-trabalhos.js';
import { criarRecuperacaoTrabalhos } from '../../../src/jobs/recuperacao-trabalhos.js';
import type { ManipuladorDeTrabalho, StatusDeTrabalho } from '../../../src/jobs/trabalhos.tipos.js';
import type { ContaId, TrabalhoId } from '../../../src/shared/ids.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  CABECALHO,
  MAPEAMENTO_PADRAO,
  confirmarEnvio,
  enviarArquivo,
  linhasDeComentario,
  type Previa,
} from '../../helpers/envios.js';
import {
  TOKENS_DE_UMA_REQUISICAO,
  contarLivro,
  criarControleDeTeste,
  requisicaoDeTeste,
  somarLivro,
  type ControleDeTeste,
} from '../../helpers/custo.js';
import {
  criarContaDeTeste,
  criarLancamentoDeConsumoDeTeste,
  criarPlanoDeTeste,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarTrabalhoDeTeste,
  criarUsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

const TOTAL_DE_ITENS = 20;

describe('pausa por limite, ganchos de recuperação e isolamento do livro', () => {
  let aplicacao: AppDeTeste;
  let teste: ControleDeTeste;
  const executores: ExecutorTrabalhos[] = [];

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ ajustesDoExecutor: { intervaloConsultaMs: 20 } });
    teste = criarControleDeTeste(aplicacao.banco);
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });
  afterEach(async () => {
    await Promise.all(executores.splice(0).map((executor) => executor.parar()));
  });

  async function criarContaComLimite(limite: string): Promise<ContaId> {
    const planoId = await criarPlanoDeTeste(aplicacao.banco, {
      limiteCustoIaUsd: limite,
      ativo: false,
    });
    return criarContaDeTeste(aplicacao.banco, { planoId });
  }

  function criarExecutor(
    manipulador: ManipuladorDeTrabalho,
    ganchos: { nome: string; executar: () => Promise<void> }[] = [],
  ) {
    const fila = criarFilaTrabalhos(aplicacao.banco);
    const relogio = { agora: () => new Date() };
    const registrador = criarRegistradorCapturado().registrador;
    const executor = criarExecutorTrabalhos({
      fila,
      manipuladores: { summarize: manipulador },
      recuperacao: criarRecuperacaoTrabalhos({ fila, ganchos, relogio, registrador }),
      relogio,
      registrador,
      intervaloConsultaMs: 10,
    });
    executores.push(executor);
    return executor;
  }

  async function statusDoJob(id: TrabalhoId): Promise<{ status: StatusDeTrabalho; feito: number }> {
    const linha = await aplicacao.banco.query<{
      status: StatusDeTrabalho;
      progresso_feito: number;
    }>('SELECT status, progresso_feito FROM trabalhos WHERE id = $1', [id]);
    return {
      status: linha.rows[0]?.status ?? 'failed',
      feito: linha.rows[0]?.progresso_feito ?? -1,
    };
  }

  describe('job que consome custo', () => {
    it('pausa exatamente no limite, guarda onde parou e retoma do ponto certo quando o limite sobe', async () => {
      const contaId = await criarContaComLimite('0.070000');
      const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
      const jobId = await criarTrabalhoDeTeste(aplicacao.banco, contaId, { projetoId });
      const processados: number[] = [];
      const manipulador: ManipuladorDeTrabalho = async ({ trabalho, atualizarProgresso }) => {
        for (let item = trabalho.progressoFeito; item < TOTAL_DE_ITENS; item += 1) {
          await teste.controle.executarComReserva(contaId, requisicaoDeTeste(), () => {
            processados.push(item);
            return Promise.resolve({
              valor: item,
              uso: { tokensEntrada: TOKENS_DE_UMA_REQUISICAO, tokensSaida: 0 },
            });
          });
          await atualizarProgresso(TOTAL_DE_ITENS, item + 1);
        }
      };
      const reavaliar = {
        nome: 'reavaliar-jobs-pausados',
        executar: () => teste.controle.reavaliarJobsPausados().then(() => undefined),
      };

      const primeiro = criarExecutor(manipulador);
      await primeiro.iniciar();
      await aguardarAte(async () => (await statusDoJob(jobId)).status === 'paused_limit');

      expect(await statusDoJob(jobId)).toEqual({ status: 'paused_limit', feito: 7 });
      expect(processados).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(await somarLivro(aplicacao.banco, contaId)).toBe('0.07000000');
      await teste.controle.reavaliarJobsPausados();
      expect((await statusDoJob(jobId)).status).toBe('paused_limit');

      await aplicacao.banco.query(
        'UPDATE planos SET limite_custo_ia_usd = 10 WHERE id = (SELECT plano_id FROM contas WHERE id = $1)',
        [contaId],
      );
      await criarRecuperacaoTrabalhos({
        fila: criarFilaTrabalhos(aplicacao.banco),
        ganchos: [reavaliar],
        relogio: { agora: () => new Date() },
        registrador: criarRegistradorCapturado().registrador,
      }).executarNaInicializacao();
      await aguardarAte(async () => (await statusDoJob(jobId)).status === 'done');

      expect(processados).toEqual(Array.from({ length: TOTAL_DE_ITENS }, (_v, i) => i));
      expect((await statusDoJob(jobId)).feito).toBe(TOTAL_DE_ITENS);
    });

    it('a inicialização do servidor devolve a pending os jobs pausados que agora cabem', async () => {
      const app = await montarAppDeTeste();
      const contaId = await criarContaComLimite('0.050000');
      await criarLancamentoDeConsumoDeTeste(app.banco, contaId, { usd: '0.05000000' });
      const projetoId = await criarProjetoDeTeste(app.banco, contaId);
      const pausado = await criarTrabalhoDeTeste(app.banco, contaId, {
        projetoId,
        status: 'paused_limit',
        tipo: 'classify',
      });

      await app.executorDeTrabalhos.iniciar();
      await app.executorDeTrabalhos.parar();
      const semFolga = await statusDoJob(pausado);
      await app.banco.query(
        'UPDATE planos SET limite_custo_ia_usd = 1 WHERE id = (SELECT plano_id FROM contas WHERE id = $1)',
        [contaId],
      );
      const reiniciado = await montarAppDeTeste({ prepararBanco: false });
      await reiniciado.executorDeTrabalhos.iniciar();
      await reiniciado.executorDeTrabalhos.parar();

      expect(semFolga.status).toBe('paused_limit');
      expect((await statusDoJob(pausado)).status).toBe('pending');
      await reiniciado.encerrar();
      await app.encerrar();
    });
  });

  describe('reservas antigas', () => {
    it('o gancho da inicialização libera reservas com mais de 15 minutos e preserva as recentes', async () => {
      const app = await montarAppDeTeste();
      const contaId = await criarContaComLimite('1.000000');
      await criarLancamentoDeConsumoDeTeste(app.banco, contaId, {
        status: 'reserved',
        idadeEmMinutos: 20,
      });
      await criarLancamentoDeConsumoDeTeste(app.banco, contaId, {
        status: 'reserved',
        idadeEmMinutos: 14,
      });
      await criarLancamentoDeConsumoDeTeste(app.banco, contaId, {
        status: 'settled',
        idadeEmMinutos: 60,
      });

      await app.executorDeTrabalhos.iniciar();
      await app.executorDeTrabalhos.parar();

      expect(await contarLivro(app.banco, contaId, 'released')).toBe(1);
      expect(await contarLivro(app.banco, contaId, 'reserved')).toBe(1);
      expect(await contarLivro(app.banco, contaId, 'settled')).toBe(1);
      await app.encerrar();
    });
  });

  describe('importar continua liberado com o limite atingido', () => {
    it('importa a planilha mesmo com o plano esgotado, porque não consome IA', async () => {
      const contaId = await criarContaComLimite('0.050000');
      await criarLancamentoDeConsumoDeTeste(aplicacao.banco, contaId, { usd: '0.05000000' });
      const usuario = await criarUsuarioDeTeste(aplicacao.banco, contaId);
      const projetoId = await criarProjetoDeTeste(aplicacao.banco, contaId);
      const cookie = await entrar(aplicacao, usuario.email);
      await aplicacao.executorDeTrabalhos.iniciar();

      const envio = (
        await enviarArquivo(
          aplicacao,
          cookie,
          projetoId,
          'a.csv',
          Buffer.from(CABECALHO + linhasDeComentario(25)),
        )
      ).json<Previa>();
      const confirmacao = await confirmarEnvio(aplicacao, cookie, projetoId, envio.envioId, {
        mapeamento: MAPEAMENTO_PADRAO,
      });
      const { trabalhoId } = confirmacao.json<{ trabalhoId: string }>();
      await aguardarAte(async () => {
        const job = await aplicacao.banco.query<{ status: string }>(
          'SELECT status FROM trabalhos WHERE id = $1',
          [trabalhoId],
        );
        return job.rows[0]?.status === 'done';
      });

      const comentarios = await aplicacao.banco.query(
        'SELECT 1 FROM comentarios WHERE projeto_id = $1',
        [projetoId],
      );
      expect(comentarios.rowCount).toBe(25);
    });
  });

  describe('livro-razão e encerramento da conta', () => {
    it('mantém o consumo sem vínculo com a conta e sem nenhum texto depois que ela é encerrada', async () => {
      const contaId = await criarContaComLimite('1.000000');
      const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId);
      const cookie = await entrar(aplicacao, dono.email);
      await teste.controle.executarComReserva(contaId, requisicaoDeTeste(), () =>
        Promise.resolve({ valor: 1, uso: { tokensEntrada: 100, tokensSaida: 0 } }),
      );

      const resposta = await chamar(aplicacao, {
        metodo: 'DELETE',
        url: '/api/conta',
        cookie,
        corpo: { senha: dono.senha },
      });

      const linhas = await aplicacao.banco.query<{ conta_id: string | null; real_usd: string }>(
        'SELECT conta_id, real_usd::text FROM livro_razao_consumo WHERE conta_ref = $1',
        [contaId],
      );
      const colunasDeTexto = await aplicacao.banco.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'livro_razao_consumo' AND data_type = 'text' ORDER BY column_name`,
      );
      expect(resposta.statusCode).toBe(204);
      expect(linhas.rows).toEqual([{ conta_id: null, real_usd: '0.00010000' }]);
      expect(colunasDeTexto.rows.map((c) => c.column_name)).toEqual([
        'modelo',
        'operacao',
        'provedor',
        'status',
      ]);
    });

    it('uma conta não enxerga nem consome o limite de outra', async () => {
      const contaA = await criarContaComLimite('0.070000');
      const contaB = await criarContaComLimite('0.070000');
      for (let i = 0; i < 7; i += 1) {
        await teste.controle.executarComReserva(contaA, requisicaoDeTeste(), () =>
          Promise.resolve({
            valor: 1,
            uso: { tokensEntrada: TOKENS_DE_UMA_REQUISICAO, tokensSaida: 0 },
          }),
        );
      }

      const estimativaB = await teste.controle.estimarConsumoDoPlano(contaB, [requisicaoDeTeste()]);
      const outraChamada = await teste.controle.executarComReserva(
        contaB,
        requisicaoDeTeste(),
        () =>
          Promise.resolve({
            valor: 'ok',
            uso: { tokensEntrada: TOKENS_DE_UMA_REQUISICAO, tokensSaida: 0 },
          }),
      );

      expect(estimativaB.porcentagemJaConsumida).toBe(0);
      expect(outraChamada).toBe('ok');
      expect(await somarLivro(aplicacao.banco, contaA)).toBe('0.07000000');
      expect(await somarLivro(aplicacao.banco, contaB)).toBe('0.01000000');
    });
  });
});
