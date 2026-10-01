import { criarAutenticacaoSistemaRepositorio } from './modules/auth/autenticacao.sistema.repositorio.js';
import type { ControleDeCusto } from './modules/usage/controle-custo.servico.js';
import { criarAgendador, type Agendador } from './scheduler/agendador.js';
import { montarAgendamentos } from './scheduler/agendamentos.js';
import { criarExecucoesAgendadasSistemaRepositorio } from './scheduler/execucoes-agendadas.sistema.repositorio.js';
import type { Banco } from './db/conexoes.js';
import type { ArmazenamentoDeSessao } from './http/plugins/sessao.plugin.js';
import type { Relogio } from './shared/clock.js';
import type { Registrador } from './shared/logger.js';

export interface EntradaDoAgendador {
  banco: Banco;
  relogio: Relogio;
  registrador: Registrador;
  custo: ControleDeCusto;
  armazenamentoDeSessao: ArmazenamentoDeSessao;
  limparEnviosOrfaos: () => Promise<void>;
}

export function montarAgendadorDoSistema(entrada: EntradaDoAgendador): Agendador {
  const autenticacao = criarAutenticacaoSistemaRepositorio(entrada.banco);
  return criarAgendador({
    agendamentos: montarAgendamentos({
      virarCiclosVencidos: () => entrada.custo.virarCiclosVencidos(),
      liberarReservasAntigas: () => entrada.custo.liberarReservasAntigas(),
      limparSessoesExpiradas: () => entrada.armazenamentoDeSessao.apagarExpiradas(),
      limparTokensExpirados: () => autenticacao.apagarTokensExpirados(entrada.relogio.agora()),
      limparEnviosOrfaos: entrada.limparEnviosOrfaos,
    }),
    repositorio: criarExecucoesAgendadasSistemaRepositorio(entrada.banco),
    relogio: entrada.relogio,
    registrador: entrada.registrador,
  });
}
