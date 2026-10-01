import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ResumosServico } from '../../modules/summaries/resumos.servico.js';
import type { ManipuladorDeTrabalho } from '../trabalhos.tipos.js';

// Idempotente: o cache por hash de dados faz um resumo já pronto não custar de novo ao retomar.
export function criarManipuladorResumir(servico: ResumosServico): ManipuladorDeTrabalho {
  return async ({ trabalho, sinal, atualizarProgresso }) => {
    if (trabalho.projetoId === undefined) {
      throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
    }
    await servico.gerar(trabalho.contaId, trabalho.projetoId, trabalho.carga, {
      sinal,
      atualizarProgresso,
    });
  };
}
