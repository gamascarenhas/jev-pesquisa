import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId } from '../../shared/ids.js';
import type { Conta, ContasRepositorio } from './contas.repositorio.js';

export interface ContasServico {
  obter(contaId: ContaId): Promise<Conta>;
  apagar(contaId: ContaId): Promise<void>;
}

export function criarContasServico(repositorio: ContasRepositorio): ContasServico {
  return {
    async obter(contaId) {
      const conta = await repositorio.buscarPorId(contaId);
      if (conta === undefined) {
        throw new ErroNaoEncontrado('Conta não encontrada.', 'conta_nao_encontrada');
      }
      return conta;
    },
    async apagar(contaId) {
      await repositorio.apagar(contaId);
    },
  };
}
