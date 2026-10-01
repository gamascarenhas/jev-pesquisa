import { ErroServicoIndisponivel } from '../../shared/errors.js';
import type { ProvedorDeCobranca } from './provedor-cobranca.js';

function cobrancaDesativada(): Promise<never> {
  return Promise.reject(
    new ErroServicoIndisponivel(
      'A troca de plano ainda não está disponível.',
      'cobranca_desativada',
    ),
  );
}

// Usado com COBRANCA_ATIVADA=false: nada é cobrado e nenhum plano muda por aqui.
export class ProvedorDeCobrancaDesativado implements ProvedorDeCobranca {
  criarAssinatura = cobrancaDesativada;
  trocarDePlano = cobrancaDesativada;
  cancelar = cobrancaDesativada;
}

export function criarProvedorDeCobrancaDesativado(): ProvedorDeCobranca {
  return new ProvedorDeCobrancaDesativado();
}
