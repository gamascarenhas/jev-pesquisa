import type { EntradaDaComposicao } from './composicao.js';
import type { ClassificadorDeComentarios } from './integrations/jev/classificador-comentarios.js';
import { criarProvedorAnthropic } from './integrations/llm/provedor-anthropic.js';
import type { ProvedorLlm } from './integrations/llm/provedor-llm.js';
import { criarProvedorLlmSimulado } from './integrations/llm/provedor-llm-simulado.js';
import { criarManipuladorResumir } from './jobs/handlers/resumir.manipulador.js';
import type { ManipuladorDeTrabalho } from './jobs/trabalhos.tipos.js';
import type { TrabalhosServico } from './jobs/trabalhos.servico.js';
import type { ComentariosServico } from './modules/comments/comentarios.servico.js';
import type { ProjetosServico } from './modules/projects/projetos.servico.js';
import { criarResumosRepositorio } from './modules/summaries/resumos.repositorio.js';
import { criarResumosServico, type ResumosServico } from './modules/summaries/resumos.servico.js';
import type { ControleDeCusto } from './modules/usage/controle-custo.servico.js';

export interface Resumos {
  servico: ResumosServico;
  manipulador: ManipuladorDeTrabalho;
}

function criarProvedorLlm(entrada: EntradaDaComposicao): ProvedorLlm {
  const { llm } = entrada.configuracao;
  return (
    entrada.opcoes.provedorLlm ??
    (llm.provedor === 'mock'
      ? criarProvedorLlmSimulado()
      : criarProvedorAnthropic({ chaveApi: llm.chaveApi ?? '', modelo: llm.modelo ?? '' }))
  );
}

export function montarResumos(
  entrada: EntradaDaComposicao,
  base: {
    projetos: ProjetosServico;
    trabalhos: TrabalhosServico;
    comentarios: ComentariosServico;
    custo: ControleDeCusto;
    classificador: ClassificadorDeComentarios;
  },
): Resumos {
  const { banco, configuracao, registrador, relogio } = entrada;
  const servico = criarResumosServico({
    repositorio: criarResumosRepositorio(banco),
    comentarios: base.comentarios,
    projetos: base.projetos,
    trabalhos: base.trabalhos,
    controleDeCusto: base.custo,
    llm: criarProvedorLlm(entrada),
    classificador: base.classificador,
    relogio,
    registrador,
    configuracao: {
      maximoDeTokens: configuracao.llm.resumoMaxTokens,
      limiarDeSustentacao: configuracao.llm.limiarSustentacao,
    },
  });
  return { servico, manipulador: criarManipuladorResumir(servico) };
}
