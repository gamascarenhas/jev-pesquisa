import type { Relogio } from '../../shared/clock.js';
import type { ContaId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ConsumoRepositorio } from './consumo.repositorio.js';
import type { ConsumoSistemaRepositorio } from './consumo.sistema.repositorio.js';

export interface DependenciasDosCiclos {
  consumo: ConsumoRepositorio;
  sistema: ConsumoSistemaRepositorio;
  relogio: Relogio;
  registrador: Registrador;
  /** A reavaliação da fase 6, reaproveitada: o ciclo novo começa sem consumo e os jobs pausados voltam a caber. */
  reavaliarJobsPausados: () => Promise<number>;
}

export interface CiclosServico {
  virarCiclosVencidos(): Promise<number>;
  /** Só para desenvolvimento: vence o ciclo da conta agora e vira. */
  forcarVirada(contaId: ContaId): Promise<boolean>;
}

export function criarCiclosServico(dep: DependenciasDosCiclos): CiclosServico {
  async function retomarJobs(virados: number): Promise<void> {
    if (virados === 0) {
      return;
    }
    const retomados = await dep.reavaliarJobsPausados();
    dep.registrador.info({ categoria: 'ciclo', virados, retomados }, 'ciclos virados');
  }

  return {
    async virarCiclosVencidos() {
      const agora = dep.relogio.agora();
      let virados = 0;
      for (const contaId of await dep.sistema.listarContasComCicloVencido(agora)) {
        if (await dep.consumo.avancarCiclo(contaId, agora)) {
          virados += 1;
        }
      }
      await retomarJobs(virados);
      return virados;
    },

    async forcarVirada(contaId) {
      const agora = dep.relogio.agora();
      await dep.consumo.vencerCicloAgora(contaId, agora);
      const virou = await dep.consumo.avancarCiclo(contaId, agora);
      await retomarJobs(virou ? 1 : 0);
      return virou;
    },
  };
}
