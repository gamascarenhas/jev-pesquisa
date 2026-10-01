import { setTimeout as esperar } from 'node:timers/promises';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  criarExecutorTrabalhos,
  type ExecutorTrabalhos,
  type OpcoesDoExecutor,
} from '../../../src/jobs/executor-trabalhos.js';
import { criarFilaTrabalhos, type FilaTrabalhos } from '../../../src/jobs/fila-trabalhos.js';
import { criarRecuperacaoTrabalhos } from '../../../src/jobs/recuperacao-trabalhos.js';
import {
  ErroTemporarioDeTrabalho,
  type GanchoDeRecuperacao,
  type ManipuladorDeTrabalho,
  type StatusDeTrabalho,
} from '../../../src/jobs/trabalhos.tipos.js';
import { ErroLimiteDeCustoAtingido } from '../../../src/shared/errors.js';
import type { ContaId, TrabalhoId } from '../../../src/shared/ids.js';
import type { Relogio } from '../../../src/shared/clock.js';
import { aguardarAte } from '../../helpers/aguardar.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaDeTeste,
  criarRegistradorCapturado,
  criarTrabalhoDeTeste,
  gerarUuid,
} from '../../helpers/factories.js';

const INTERVALO_RAPIDO_MS = 10;
const TEXTO_SECRETO = 'TEXTO-SECRETO-DE-COMENTARIO';

interface LinhaDoJob {
  status: StatusDeTrabalho;
  tentativas: number;
  progresso_feito: number;
  bloqueado_por: string | null;
  ultimo_erro: string | null;
  executar_apos: Date;
  sinal_vida_em: Date | null;
}

type ExtrasDoExecutor = Partial<OpcoesDoExecutor> & {
  ganchos?: GanchoDeRecuperacao[];
  limiteSinalDeVidaMs?: number;
};

describe('fila e executor de jobs', () => {
  let aplicacao: AppDeTeste;
  let fila: FilaTrabalhos;
  let contaId: ContaId;
  let captura = criarRegistradorCapturado();
  const executores: ExecutorTrabalhos[] = [];

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
    fila = criarFilaTrabalhos(aplicacao.banco);
    contaId = await criarContaDeTeste(aplicacao.banco);
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });
  beforeEach(async () => {
    captura = criarRegistradorCapturado();
    await aplicacao.banco.query('DELETE FROM trabalhos');
  });
  afterEach(async () => {
    await Promise.all(executores.splice(0).map((executor) => executor.parar()));
  });

  function criarExecutor(
    manipulador: ManipuladorDeTrabalho,
    extras: ExtrasDoExecutor = {},
  ): ExecutorTrabalhos {
    const { ganchos, limiteSinalDeVidaMs, ...opcoes } = extras;
    const relogio = opcoes.relogio ?? { agora: () => new Date() };
    const executor = criarExecutorTrabalhos({
      fila,
      manipuladores: { summarize: manipulador },
      recuperacao: criarRecuperacaoTrabalhos({
        fila,
        ganchos: ganchos ?? [],
        relogio,
        registrador: captura.registrador,
        ...(limiteSinalDeVidaMs === undefined ? {} : { limiteSinalDeVidaMs }),
      }),
      relogio,
      registrador: captura.registrador,
      intervaloConsultaMs: INTERVALO_RAPIDO_MS,
      ...opcoes,
    });
    executores.push(executor);
    return executor;
  }

  async function lerJob(id: TrabalhoId): Promise<LinhaDoJob> {
    const resultado = await aplicacao.banco.query<LinhaDoJob>(
      'SELECT * FROM trabalhos WHERE id = $1',
      [id],
    );
    const linha = resultado.rows[0];
    if (linha === undefined) {
      throw new Error('Job não encontrado no teste.');
    }
    return linha;
  }

  async function aguardarStatus(id: TrabalhoId, status: StatusDeTrabalho): Promise<void> {
    await aguardarAte(async () => (await lerJob(id)).status === status);
  }

  async function aguardarReagendamento(id: TrabalhoId, tentativas: number): Promise<LinhaDoJob> {
    await aguardarAte(async () => {
      const job = await lerJob(id);
      return job.tentativas === tentativas && job.status === 'pending';
    });
    return lerJob(id);
  }

  async function criarOrfao(sinalDeVida: string, bloqueadoPor = 'instancia-morta') {
    const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId, { status: 'running' });
    await aplicacao.banco.query(
      `UPDATE trabalhos SET bloqueado_por = $2, tentativas = 1, sinal_vida_em = ${sinalDeVida}
        WHERE id = $1`,
      [id, bloqueadoPor],
    );
    return id;
  }

  it('dois executores concorrentes nunca pegam o mesmo job', async () => {
    const total = 24;
    for (let i = 0; i < total; i += 1) {
      await criarTrabalhoDeTeste(aplicacao.banco, contaId, { carga: { indice: i } });
    }
    const execucoes: number[] = [];
    const manipulador: ManipuladorDeTrabalho = async ({ trabalho }) => {
      execucoes.push(trabalho.carga.indice as number);
      await esperar(15);
    };

    const primeiro = criarExecutor(manipulador, { instanciaId: 'a', concorrencia: 3 });
    const segundo = criarExecutor(manipulador, { instanciaId: 'b', concorrencia: 3 });
    await Promise.all([primeiro.iniciar(), segundo.iniciar()]);
    await aguardarAte(async () => {
      const feitos = await aplicacao.banco.query("SELECT 1 FROM trabalhos WHERE status = 'done'");
      return feitos.rowCount === total;
    });

    expect(execucoes).toHaveLength(total);
    expect(new Set(execucoes).size).toBe(total);
  });

  it('não pega jobs de tipo sem manipulador registrado', async () => {
    const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId, { tipo: 'classify' });

    const executor = criarExecutor(() => Promise.resolve());
    await executor.iniciar();
    await esperar(100);

    expect((await lerJob(id)).status).toBe('pending');
  });

  it('um job running órfão volta para pending na recuperação e termina', async () => {
    const orfao = await criarOrfao("now() - interval '5 minutes'");
    const vivo = await criarOrfao('now()', 'instancia-viva');
    const executados: string[] = [];

    const executor = criarExecutor(({ trabalho }) => {
      executados.push(trabalho.id);
      return Promise.resolve();
    });
    await executor.iniciar();
    await aguardarStatus(orfao, 'done');

    expect(executados).toEqual([orfao]);
    expect((await lerJob(vivo)).status).toBe('running');
  });

  it('recupera órfãos também durante a execução, sem precisar reiniciar', async () => {
    const id = await criarOrfao('now()');

    const executor = criarExecutor(() => Promise.resolve(), {
      limiteSinalDeVidaMs: 150,
      intervaloRecuperacaoMs: 30,
    });
    await executor.iniciar();
    await aguardarStatus(id, 'done');
  });

  it('falha o órfão que já gastou todas as tentativas, para não repetir uma queda para sempre', async () => {
    const id = await criarOrfao("now() - interval '5 minutes'");
    await aplicacao.banco.query('UPDATE trabalhos SET max_tentativas = 1 WHERE id = $1', [id]);

    await criarRecuperacaoTrabalhos({
      fila,
      ganchos: [],
      relogio: { agora: () => new Date() },
      registrador: captura.registrador,
    }).executarNaInicializacao();

    const job = await lerJob(id);
    expect(job.status).toBe('failed');
    expect(job.ultimo_erro).toBe('interrompido_repetidamente');
  });

  it('atualiza o sinal de vida enquanto o handler roda e guarda o progresso', async () => {
    const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId);
    let liberar!: () => void;
    const liberado = new Promise<void>((resolver) => {
      liberar = resolver;
    });

    const executor = criarExecutor(
      async ({ atualizarProgresso }) => {
        await atualizarProgresso(10, 4);
        await liberado;
      },
      { intervaloSinalDeVidaMs: 20 },
    );
    await executor.iniciar();
    await aguardarAte(async () => (await lerJob(id)).progresso_feito === 4);
    const primeiro = (await lerJob(id)).sinal_vida_em;
    await aguardarAte(async () => {
      const atual = (await lerJob(id)).sinal_vida_em;
      return atual !== null && primeiro !== null && atual > primeiro;
    });
    liberar();
    await aguardarStatus(id, 'done');

    const final = await aplicacao.banco.query<{ progresso_total: number; progresso_feito: number }>(
      'SELECT progresso_total, progresso_feito FROM trabalhos WHERE id = $1',
      [id],
    );
    expect(final.rows[0]).toEqual({ progresso_total: 10, progresso_feito: 4 });
  });

  describe('erros', () => {
    it('repete com atraso crescente até max_tentativas e depois falha', async () => {
      const inicio = Date.now() + 60_000;
      let atual = new Date(inicio);
      const relogio: Relogio = { agora: () => atual };
      const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        maxTentativas: 3,
        executarApos: new Date(inicio - 1),
      });

      const executor = criarExecutor(
        () => Promise.reject(new ErroTemporarioDeTrabalho('jev_indisponivel')),
        { relogio, aleatorio: () => 1 },
      );
      await executor.iniciar();

      const primeira = await aguardarReagendamento(id, 1);
      expect(primeira.executar_apos.getTime()).toBe(inicio + 5_000);
      expect(primeira.ultimo_erro).toBe('ErroTemporarioDeTrabalho: jev_indisponivel');
      await esperar(60);
      expect((await lerJob(id)).tentativas).toBe(1);

      atual = new Date(inicio + 5_000);
      const segunda = await aguardarReagendamento(id, 2);
      expect(segunda.executar_apos.getTime()).toBe(inicio + 15_000);

      atual = new Date(inicio + 15_000);
      await aguardarStatus(id, 'failed');
      expect((await lerJob(id)).tentativas).toBe(3);
    });

    it('erro definitivo falha na primeira vez, sem texto do erro em ultimo_erro nem nos logs', async () => {
      const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        carga: { texto: TEXTO_SECRETO },
      });

      const executor = criarExecutor(({ trabalho }) =>
        Promise.reject(new Error(`falhou com ${String(trabalho.carga.texto)}`)),
      );
      await executor.iniciar();
      await aguardarStatus(id, 'failed');

      const job = await lerJob(id);
      expect(job.tentativas).toBe(1);
      expect(job.ultimo_erro).toBe('Error');
      expect(job.bloqueado_por).toBeNull();
      expect(captura.texto()).not.toContain(TEXTO_SECRETO);
    });

    it('ErroLimiteDeCustoAtingido pausa o job sem gastar tentativa', async () => {
      const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId);

      const executor = criarExecutor(async ({ atualizarProgresso }) => {
        await atualizarProgresso(10, 6);
        throw new ErroLimiteDeCustoAtingido();
      });
      await executor.iniciar();
      await aguardarStatus(id, 'paused_limit');

      const job = await lerJob(id);
      expect(job).toMatchObject({ tentativas: 0, progresso_feito: 6, bloqueado_por: null });
    });

    it('registra as estatísticas do job em log estruturado, sem dado de comentário', async () => {
      const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId, {
        carga: { texto: TEXTO_SECRETO },
      });

      const executor = criarExecutor(() => Promise.resolve());
      await executor.iniciar();
      await aguardarStatus(id, 'done');

      const evento = captura.linhas().find((linha) => linha.idTrabalho === id);
      expect(evento).toMatchObject({
        categoria: 'trabalho',
        idTrabalho: id,
        tipo: 'summarize',
        resultado: 'concluido',
        tentativas: 1,
      });
      expect(typeof evento?.duracaoMs).toBe('number');
      expect(captura.texto()).not.toContain(TEXTO_SECRETO);
    });
  });

  describe('desligamento', () => {
    it('devolve a pending o job que não terminou, sem perder progresso nem gastar tentativa', async () => {
      const id = await criarTrabalhoDeTeste(aplicacao.banco, contaId);
      let sinalAbortado = false;

      const executor = criarExecutor(
        async ({ atualizarProgresso, sinal }) => {
          await atualizarProgresso(10, 7);
          await new Promise<void>((resolver) => {
            sinal.addEventListener('abort', () => {
              sinalAbortado = true;
              resolver();
            });
          });
        },
        { tempoLimiteDesligamentoMs: 80 },
      );
      await executor.iniciar();
      await aguardarAte(async () => (await lerJob(id)).progresso_feito === 7);
      await executor.parar();
      await esperar(40);

      const job = await lerJob(id);
      expect(job).toMatchObject({
        status: 'pending',
        tentativas: 0,
        progresso_feito: 7,
        bloqueado_por: null,
      });
      expect(sinalAbortado).toBe(true);
    });

    it('espera o handler que termina dentro do prazo e não pega jobs novos', async () => {
      const primeiro = await criarTrabalhoDeTeste(aplicacao.banco, contaId);
      const executor = criarExecutor(() => esperar(100), { concorrencia: 1 });
      await executor.iniciar();
      await aguardarStatus(primeiro, 'running');
      const segundo = await criarTrabalhoDeTeste(aplicacao.banco, contaId);

      await executor.parar();
      await esperar(60);

      expect((await lerJob(primeiro)).status).toBe('done');
      expect((await lerJob(segundo)).status).toBe('pending');
    });
  });

  describe('ganchos de recuperação', () => {
    it('rodam na inicialização, e a falha de um não impede os outros', async () => {
      const chamados: string[] = [];
      const ganchos: GanchoDeRecuperacao[] = [
        {
          nome: 'primeiro',
          executar: () => {
            chamados.push('primeiro');
            return Promise.reject(new Error(`falha ${gerarUuid()}`));
          },
        },
        {
          nome: 'segundo',
          executar: () => {
            chamados.push('segundo');
            return Promise.resolve();
          },
        },
      ];

      const executor = criarExecutor(() => Promise.resolve(), { ganchos });
      await executor.iniciar();

      expect(chamados).toEqual(['primeiro', 'segundo']);
      expect(captura.linhas().find((linha) => linha.gancho === 'primeiro')).toMatchObject({
        categoria: 'trabalho',
        erro: 'Error',
      });
    });
  });
});
