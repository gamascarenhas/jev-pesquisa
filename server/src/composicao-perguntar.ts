import type { EntradaDaComposicao } from './composicao.js';
import type { ClassificadorDeComentarios } from './integrations/jev/classificador-comentarios.js';
import type { ProvedorLlm } from './integrations/llm/provedor-llm.js';
import { criarManipuladorPerguntar } from './jobs/handlers/perguntar.manipulador.js';
import type { TrabalhosServico } from './jobs/trabalhos.servico.js';
import type { ManipuladorDeTrabalho } from './jobs/trabalhos.tipos.js';
import { ExecutorDePergunta } from './modules/ask/executor-pergunta.js';
import { InterpretadorDePergunta } from './modules/ask/interpretador-pergunta.js';
import { criarPerguntasPersonalizadasRepositorio } from './modules/ask/perguntas-personalizadas.repositorio.js';
import { criarPerguntarServico, type PerguntarServico } from './modules/ask/perguntar.servico.js';
import type { ComentariosServico } from './modules/comments/comentarios.servico.js';
import type { ProjetosServico } from './modules/projects/projetos.servico.js';
import type { ControleDeCusto } from './modules/usage/controle-custo.servico.js';

export interface Perguntar {
  servico: PerguntarServico;
  manipulador: ManipuladorDeTrabalho;
}

export function montarPerguntar(
  entrada: EntradaDaComposicao,
  base: {
    projetos: ProjetosServico;
    trabalhos: TrabalhosServico;
    comentarios: ComentariosServico;
    custo: ControleDeCusto;
    classificador: ClassificadorDeComentarios;
    llm: ProvedorLlm;
  },
): Perguntar {
  const { banco, configuracao, registrador } = entrada;
  const repositorio = criarPerguntasPersonalizadasRepositorio(banco);
  const maximoDeComentarios = configuracao.perguntarMaxComentarios;
  const servico = criarPerguntarServico({
    repositorio,
    interpretador: new InterpretadorDePergunta({ llm: base.llm, controleDeCusto: base.custo }),
    executor: new ExecutorDePergunta({
      repositorio,
      comentarios: base.comentarios,
      controleDeCusto: base.custo,
      classificador: base.classificador,
      registrador,
      concorrencia: configuracao.jev.concorrencia,
      maximoDeComentarios,
    }),
    comentarios: base.comentarios,
    projetos: base.projetos,
    trabalhos: base.trabalhos,
    controleDeCusto: base.custo,
    registrador,
    maximoDeComentarios,
  });
  return { servico, manipulador: criarManipuladorPerguntar(servico) };
}
