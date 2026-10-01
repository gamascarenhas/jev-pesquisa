import type { Agendamento } from './agendador.js';

export interface TarefasDoSistema {
  virarCiclosVencidos: () => Promise<unknown>;
  liberarReservasAntigas: () => Promise<unknown>;
  limparSessoesExpiradas: () => Promise<unknown>;
  limparTokensExpirados: () => Promise<unknown>;
  limparEnviosOrfaos: () => Promise<unknown>;
  sincronizarGoogle: () => Promise<unknown>;
}

const HORAS_POR_DIA = 24;
const HORA_DA_SINCRONIZACAO_DIARIA = 3;

function expressaoDaSincronizacao(intervaloEmHoras: number): string {
  return intervaloEmHoras >= HORAS_POR_DIA
    ? `0 ${String(HORA_DA_SINCRONIZACAO_DIARIA)} * * *`
    : `0 */${String(intervaloEmHoras)} * * *`;
}

async function sem(resultado: () => Promise<unknown>): Promise<void> {
  await resultado();
}

export function montarAgendamentos(
  tarefas: TarefasDoSistema,
  intervaloDaSincronizacaoEmHoras: number,
): Agendamento[] {
  return [
    {
      nome: 'google-sincronizacao',
      expressao: expressaoDaSincronizacao(intervaloDaSincronizacaoEmHoras),
      tarefa: () => sem(tarefas.sincronizarGoogle),
    },
    {
      nome: 'virada-de-ciclo',
      expressao: '*/5 * * * *',
      tarefa: () => sem(tarefas.virarCiclosVencidos),
    },
    {
      nome: 'liberar-reservas-antigas',
      expressao: '*/5 * * * *',
      tarefa: () => sem(tarefas.liberarReservasAntigas),
    },
    {
      nome: 'limpeza-de-sessoes-e-tokens',
      expressao: '17 * * * *',
      tarefa: async () => {
        await tarefas.limparSessoesExpiradas();
        await tarefas.limparTokensExpirados();
      },
    },
    {
      nome: 'limpeza-de-envios-orfaos',
      expressao: '*/30 * * * *',
      tarefa: () => sem(tarefas.limparEnviosOrfaos),
    },
  ];
}
