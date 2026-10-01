import { montarEmailDeConsumoDoPlano } from '../../integrations/mail/templates/consumo-do-plano.js';
import type { EnviadorDeEmail } from '../../integrations/mail/enviador-email.js';
import { nomeSeguroDoErro } from '../../shared/errors.js';
import type { ContaId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { Relogio } from '../../shared/clock.js';
import type { ConsumoRepositorio } from './consumo.repositorio.js';
import { porcentagem } from './valores-usd.js';

export const LIMIARES_DE_ALERTA = [80, 100] as const;
// Entre duas conferências da mesma conta; o aviso de 100% é conferido sem esperar.
export const INTERVALO_ENTRE_CONFERENCIAS_MS = 5_000;

export interface DonoDaConta {
  email: string;
  nome: string;
}

export interface DependenciasDosAlertas {
  consumo: ConsumoRepositorio;
  listarDonos: (contaId: ContaId) => Promise<DonoDaConta[]>;
  enviador: EnviadorDeEmail;
  nomeDoNegocio: string;
  relogio: Relogio;
  registrador: Registrador;
}

export interface AlertasDeConsumo {
  verificar(contaId: ContaId, opcoes?: { forcar?: boolean }): Promise<void>;
}

async function avisar(
  dep: DependenciasDosAlertas,
  contaId: ContaId,
  limiar: 80 | 100,
): Promise<void> {
  const situacao = await dep.consumo.situacaoDoConsumo(contaId);
  const conteudo = montarEmailDeConsumoDoPlano({
    nomeNegocio: dep.nomeDoNegocio,
    nomeEmpresa: situacao.nomeDaConta,
    limiar,
    renovaEm: situacao.cicloTerminaEm,
  });
  for (const dono of await dep.listarDonos(contaId)) {
    await dep.enviador.enviar({ para: dono.email, ...conteudo }).catch((erro: unknown) => {
      dep.registrador.error(
        { categoria: 'consumo', contaId, limiar, erro: nomeSeguroDoErro(erro) },
        'falha ao enviar o aviso de consumo',
      );
    });
  }
  dep.registrador.info({ categoria: 'consumo', contaId, limiar }, 'aviso de consumo enviado');
}

export function criarAlertasDeConsumo(dep: DependenciasDosAlertas): AlertasDeConsumo {
  const ultimaConferencia = new Map<string, number>();

  async function conferir(contaId: ContaId): Promise<void> {
    const { consumidoUsd8, limiteUsd8 } = await dep.consumo.situacaoDoConsumo(contaId);
    const usado = porcentagem(consumidoUsd8, limiteUsd8);
    for (const limiar of LIMIARES_DE_ALERTA) {
      if (usado >= limiar && (await dep.consumo.registrarAlerta(contaId, limiar))) {
        await avisar(dep, contaId, limiar);
      }
    }
  }

  return {
    async verificar(contaId, opcoes) {
      const agora = dep.relogio.agora().getTime();
      const anterior = ultimaConferencia.get(contaId);
      if (
        opcoes?.forcar !== true &&
        anterior !== undefined &&
        agora - anterior < INTERVALO_ENTRE_CONFERENCIAS_MS
      ) {
        return;
      }
      ultimaConferencia.set(contaId, agora);
      try {
        await conferir(contaId);
      } catch (erro) {
        // O aviso é um extra: falhar nele nunca pode derrubar a classificação.
        dep.registrador.error(
          { categoria: 'consumo', contaId, erro: nomeSeguroDoErro(erro) },
          'falha ao conferir os avisos de consumo',
        );
      }
    },
  };
}
