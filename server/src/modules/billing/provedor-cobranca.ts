import { criarProvedorDeCobrancaDesativado } from './provedor-cobranca-desativado.js';
import type { ContaId } from '../../shared/ids.js';

export interface ResultadoDaCobranca {
  planoId: string;
}

// A fronteira só; webhooks e demais detalhes pertencem ao provedor real, que ainda não existe.
export interface ProvedorDeCobranca {
  criarAssinatura(contaId: ContaId, planoId: string): Promise<ResultadoDaCobranca>;
  trocarDePlano(contaId: ContaId, planoId: string): Promise<ResultadoDaCobranca>;
  cancelar(contaId: ContaId): Promise<void>;
}

export function escolherProvedorDeCobranca(cobrancaAtivada: boolean): ProvedorDeCobranca {
  if (cobrancaAtivada) {
    throw new Error(
      'COBRANCA_ATIVADA=true exige um provedor de cobrança real, que ainda não existe.',
    );
  }
  return criarProvedorDeCobrancaDesativado();
}
