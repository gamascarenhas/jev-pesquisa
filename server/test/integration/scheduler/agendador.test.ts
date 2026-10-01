import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import cron from 'node-cron';

import { criarBanco, type Banco } from '../../../src/db/conexoes.js';
import { criarAgendador, horarioDaExecucao } from '../../../src/scheduler/agendador.js';
import { montarAgendamentos } from '../../../src/scheduler/agendamentos.js';
import { criarExecucoesAgendadasSistemaRepositorio } from '../../../src/scheduler/execucoes-agendadas.sistema.repositorio.js';
import { carregarConfiguracaoDeTeste } from '../../helpers/build-app.js';
import { criarRegistradorCapturado, gerarUuid } from '../../helpers/factories.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

describe('agendador', () => {
  let aplicacao: AppDeTeste;
  let banco: Banco;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste();
    banco = criarBanco(carregarConfiguracaoDeTeste().urlBanco);
  });
  afterAll(async () => {
    await banco.end();
    await aplicacao.encerrar();
  });

  function criarInstancia(tarefa: () => Promise<void>, nome: string) {
    const captura = criarRegistradorCapturado();
    const agendador = criarAgendador({
      agendamentos: [{ nome, expressao: '* * * * *', tarefa }],
      repositorio: criarExecucoesAgendadasSistemaRepositorio(banco),
      relogio: { agora: () => new Date() },
      registrador: captura.registrador,
    });
    return { agendador, agendamento: { nome, expressao: '* * * * *', tarefa }, captura };
  }

  it('não executa a mesma tarefa duas vezes no mesmo horário, mesmo com duas instâncias', async () => {
    const nome = `tarefa-${gerarUuid()}`;
    let execucoes = 0;
    const tarefa = (): Promise<void> => {
      execucoes += 1;
      return Promise.resolve();
    };
    const a = criarInstancia(tarefa, nome);
    const b = criarInstancia(tarefa, nome);
    const horario = horarioDaExecucao(new Date());

    const resultados = await Promise.all([
      a.agendador.executarComTrava(a.agendamento, horario),
      b.agendador.executarComTrava(b.agendamento, horario),
    ]);
    const outroMinuto = await a.agendador.executarComTrava(
      a.agendamento,
      new Date(horario.getTime() + 60_000),
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(outroMinuto).toBe(true);
    expect(execucoes).toBe(2);
  });

  it('registra o fim da execução e a falha sem derrubar o agendador', async () => {
    const nome = `tarefa-${gerarUuid()}`;
    const instancia = criarInstancia(() => Promise.reject(new Error('quebrou')), nome);
    const horario = horarioDaExecucao(new Date());

    await expect(
      instancia.agendador.executarComTrava(instancia.agendamento, horario),
    ).resolves.toBe(true);

    const linha = await banco.query<{ erro: string | null; finalizado_em: Date | null }>(
      'SELECT erro, finalizado_em FROM execucoes_agendadas WHERE nome = $1',
      [nome],
    );
    expect(linha.rows[0]?.finalizado_em).not.toBeNull();
    expect(linha.rows[0]?.erro).toBeTruthy();
    expect(instancia.captura.linhas().some((l) => l.msg === 'tarefa agendada falhou')).toBe(true);
  });

  it('o horário da trava é o minuto cheio', () => {
    expect(horarioDaExecucao(new Date('2026-01-01T10:05:42.321Z')).toISOString()).toBe(
      '2026-01-01T10:05:00.000Z',
    );
  });

  it('declara as tarefas recorrentes do sistema com expressões válidas', async () => {
    const chamadas: string[] = [];
    const registrar = (nome: string) => () => {
      chamadas.push(nome);
      return Promise.resolve();
    };
    const agendamentos = montarAgendamentos(
      {
        virarCiclosVencidos: registrar('ciclos'),
        liberarReservasAntigas: registrar('reservas'),
        limparSessoesExpiradas: registrar('sessoes'),
        limparTokensExpirados: registrar('tokens'),
        limparEnviosOrfaos: registrar('envios'),
        sincronizarGoogle: registrar('google'),
      },
      6,
    );

    expect(agendamentos.map((a) => a.nome)).toEqual([
      'google-sincronizacao',
      'virada-de-ciclo',
      'liberar-reservas-antigas',
      'limpeza-de-sessoes-e-tokens',
      'limpeza-de-envios-orfaos',
    ]);
    expect(agendamentos.every((a) => cron.validate(a.expressao))).toBe(true);
    for (const agendamento of agendamentos) {
      await agendamento.tarefa();
    }
    expect(chamadas).toEqual(['google', 'ciclos', 'reservas', 'sessoes', 'tokens', 'envios']);
  });
});
