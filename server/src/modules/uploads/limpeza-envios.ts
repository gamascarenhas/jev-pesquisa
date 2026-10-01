import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import type { Relogio } from '../../shared/clock.js';
import { comoContaId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ArmazenamentoDeEnvios } from './armazenamento-envios.js';
import { IDADE_MAXIMA_ENVIO_ORFAO_MS } from './limites-envio.js';

export interface DependenciasDeLimpeza {
  armazenamento: ArmazenamentoDeEnvios;
  trabalhos: TrabalhosServico;
  relogio: Relogio;
  registrador: Registrador;
}

export function criarLimpezaDeEnvios(dep: DependenciasDeLimpeza): () => Promise<void> {
  const emUsoPorConta = new Map<string, Set<string>>();

  async function enviosEmUso(contaId: string): Promise<Set<string>> {
    const conhecido = emUsoPorConta.get(contaId);
    if (conhecido !== undefined) {
      return conhecido;
    }
    const ativos = await dep.trabalhos.listarAtivosDoTipo(comoContaId(contaId), 'import_upload');
    const ids = new Set(ativos.map((trabalho) => String(trabalho.carga.envioId)));
    emUsoPorConta.set(contaId, ids);
    return ids;
  }

  return async () => {
    const limite = dep.relogio.agora().getTime() - IDADE_MAXIMA_ENVIO_ORFAO_MS;
    emUsoPorConta.clear();
    let apagados = 0;
    for (const envio of await dep.armazenamento.listarTodos()) {
      if (envio.modificadoEm.getTime() >= limite) {
        continue;
      }
      if (!(await enviosEmUso(envio.contaId)).has(envio.envioId)) {
        await dep.armazenamento.apagar(comoContaId(envio.contaId), envio.envioId);
        apagados += 1;
      }
    }
    if (apagados > 0) {
      dep.registrador.info({ categoria: 'envios', apagados }, 'envios órfãos apagados');
    }
  };
}
