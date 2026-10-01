import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { GoogleSincronizacaoServico } from '../../modules/google-business/google-sincronizacao.servico.js';
import type { ManipuladorDeTrabalho } from '../trabalhos.tipos.js';

// Idempotente: retomar é sincronizar de novo, e uma avaliação já gravada nunca duplica.
export function criarManipuladorGoogleSincronizacao(
  servico: GoogleSincronizacaoServico,
): ManipuladorDeTrabalho {
  return async ({ trabalho, sinal, atualizarProgresso }) => {
    if (trabalho.projetoId === undefined) {
      throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
    }
    await servico.sincronizar(trabalho.contaId, trabalho.projetoId, { sinal, atualizarProgresso });
  };
}
