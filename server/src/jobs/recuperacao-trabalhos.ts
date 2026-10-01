import { nomeSeguroDoErro } from '../shared/errors.js';
import type { Relogio } from '../shared/clock.js';
import type { Registrador } from '../shared/logger.js';
import type { FilaTrabalhos } from './fila-trabalhos.js';
import type { GanchoDeRecuperacao } from './trabalhos.tipos.js';

export const LIMITE_SINAL_DE_VIDA_MS = 60_000;

export interface DependenciasDeRecuperacao {
  fila: FilaTrabalhos;
  ganchos: GanchoDeRecuperacao[];
  relogio: Relogio;
  registrador: Registrador;
  limiteSinalDeVidaMs?: number;
}

export interface RecuperacaoTrabalhos {
  recuperarOrfaos(): Promise<void>;
  executarNaInicializacao(): Promise<void>;
}

export function criarRecuperacaoTrabalhos(dep: DependenciasDeRecuperacao): RecuperacaoTrabalhos {
  const limiteMs = dep.limiteSinalDeVidaMs ?? LIMITE_SINAL_DE_VIDA_MS;

  // Atravessa contas: devolve à fila os jobs órfãos de todas as contas.
  async function recuperarOrfaos(): Promise<void> {
    const agora = dep.relogio.agora();
    const { devolvidos, falhos } = await dep.fila.recuperarOrfaos(
      new Date(agora.getTime() - limiteMs),
      agora,
    );
    if (devolvidos > 0 || falhos > 0) {
      dep.registrador.warn(
        { categoria: 'trabalho', devolvidos, falhos },
        'jobs órfãos recuperados',
      );
    }
  }

  async function executarGancho(gancho: GanchoDeRecuperacao): Promise<void> {
    try {
      await gancho.executar();
    } catch (erro) {
      dep.registrador.error(
        { categoria: 'trabalho', gancho: gancho.nome, erro: nomeSeguroDoErro(erro) },
        'gancho de recuperação falhou',
      );
    }
  }

  return {
    recuperarOrfaos,
    async executarNaInicializacao() {
      await recuperarOrfaos();
      for (const gancho of dep.ganchos) {
        await executarGancho(gancho);
      }
    },
  };
}
