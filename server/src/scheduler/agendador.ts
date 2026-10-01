import cron, { type ScheduledTask } from 'node-cron';

import type { Relogio } from '../shared/clock.js';
import { nomeSeguroDoErro } from '../shared/errors.js';
import type { Registrador } from '../shared/logger.js';
import type { ExecucoesAgendadasSistemaRepositorio } from './execucoes-agendadas.sistema.repositorio.js';

const MS_POR_MINUTO = 60_000;
const FUSO_DO_AGENDADOR = 'America/Sao_Paulo';

export interface Agendamento {
  nome: string;
  /** Expressão cron de 5 campos, no fuso de Brasília. */
  expressao: string;
  tarefa: () => Promise<void>;
}

export interface Agendador {
  iniciar(): void;
  parar(): Promise<void>;
  /** Executa a tarefa só se esta instância ganhar a trava daquele horário; devolve se executou. */
  executarComTrava(agendamento: Agendamento, horario: Date): Promise<boolean>;
}

export interface DependenciasDoAgendador {
  agendamentos: Agendamento[];
  repositorio: ExecucoesAgendadasSistemaRepositorio;
  relogio: Relogio;
  registrador: Registrador;
}

// Todas as instâncias disparam no mesmo minuto; o minuto é a chave da trava.
export function horarioDaExecucao(disparo: Date): Date {
  return new Date(Math.floor(disparo.getTime() / MS_POR_MINUTO) * MS_POR_MINUTO);
}

async function executarComTrava(
  dep: DependenciasDoAgendador,
  agendamento: Agendamento,
  horario: Date,
): Promise<boolean> {
  const { nome } = agendamento;
  if (!(await dep.repositorio.reservar(nome, horario, dep.relogio.agora()))) {
    return false;
  }
  let erro: string | null = null;
  try {
    await agendamento.tarefa();
  } catch (causa) {
    erro = nomeSeguroDoErro(causa);
    dep.registrador.error({ categoria: 'agendador', nome, erro }, 'tarefa agendada falhou');
  }
  await dep.repositorio.finalizar(nome, horario, dep.relogio.agora(), erro);
  return true;
}

export function criarAgendador(dep: DependenciasDoAgendador): Agendador {
  const tarefas: ScheduledTask[] = [];
  const emAndamento = new Set<Promise<boolean>>();

  function disparar(agendamento: Agendamento, disparo: Date): void {
    const execucao = executarComTrava(dep, agendamento, horarioDaExecucao(disparo)).catch(
      (erro: unknown) => {
        dep.registrador.error(
          { categoria: 'agendador', nome: agendamento.nome, erro: nomeSeguroDoErro(erro) },
          'falha ao reservar a tarefa agendada',
        );
        return false;
      },
    );
    emAndamento.add(execucao);
    void execucao.finally(() => emAndamento.delete(execucao));
  }

  return {
    executarComTrava: (agendamento, horario) => executarComTrava(dep, agendamento, horario),

    iniciar() {
      for (const agendamento of dep.agendamentos) {
        tarefas.push(
          cron.schedule(
            agendamento.expressao,
            (contexto) => {
              disparar(agendamento, contexto.date);
            },
            { timezone: FUSO_DO_AGENDADOR, name: agendamento.nome, noOverlap: true },
          ),
        );
      }
    },

    async parar() {
      await Promise.all(
        tarefas.splice(0).map(async (tarefa) => {
          await tarefa.destroy();
        }),
      );
      await Promise.all(emAndamento);
    },
  };
}
