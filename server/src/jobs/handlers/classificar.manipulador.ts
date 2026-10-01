import type { ClassificacaoServico } from '../../modules/classification/classificacao.servico.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ManipuladorDeTrabalho } from '../trabalhos.tipos.js';

// O progresso é derivado dos comentários pendentes: retomar é rodar de novo.
export function criarManipuladorClassificar(servico: ClassificacaoServico): ManipuladorDeTrabalho {
  return async ({ trabalho, sinal, atualizarProgresso }) => {
    if (trabalho.projetoId === undefined) {
      throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
    }
    await servico.classificarPendentes(trabalho.contaId, trabalho.projetoId, {
      sinal,
      aoProgredir: atualizarProgresso,
    });
  };
}
