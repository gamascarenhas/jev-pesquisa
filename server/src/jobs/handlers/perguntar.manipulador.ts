import type { PerguntarServico } from '../../modules/ask/perguntar.servico.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ManipuladorDeTrabalho } from '../trabalhos.tipos.js';

// O progresso sai das respostas gravadas: retomar é rodar de novo, sem repetir comentário respondido.
export function criarManipuladorPerguntar(servico: PerguntarServico): ManipuladorDeTrabalho {
  return async ({ trabalho, sinal, atualizarProgresso }) => {
    const perguntaId = trabalho.carga.perguntaId;
    if (trabalho.projetoId === undefined || typeof perguntaId !== 'string') {
      throw new ErroNaoEncontrado('Pergunta não encontrada.', 'pergunta_nao_encontrada');
    }
    await servico.executar(trabalho.contaId, trabalho.projetoId, perguntaId, {
      sinal,
      atualizarProgresso,
    });
  };
}
