import type { Configuracao } from '../src/config/config.js';

export function exigirDesenvolvimento(configuracao: Pick<Configuracao, 'estaEmProducao'>): void {
  if (configuracao.estaEmProducao) {
    throw new Error('Este script só roda em desenvolvimento.');
  }
}
