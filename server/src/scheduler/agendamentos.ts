import type { Agendamento } from './agendador.js';

export interface TarefasDoSistema {
  virarCiclosVencidos: () => Promise<unknown>;
  liberarReservasAntigas: () => Promise<unknown>;
  limparSessoesExpiradas: () => Promise<unknown>;
  limparTokensExpirados: () => Promise<unknown>;
  limparEnviosOrfaos: () => Promise<unknown>;
}

async function sem(resultado: () => Promise<unknown>): Promise<void> {
  await resultado();
}

// A sincronização do Google entra na fase 10.
export function montarAgendamentos(tarefas: TarefasDoSistema): Agendamento[] {
  return [
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
