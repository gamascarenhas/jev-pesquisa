import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { converterFiltros } from '../comments/comentarios.servico.js';
import { MAX_CARACTERES_POR_COMENTARIO, type PerguntaGravada } from './perguntar.tipos.js';
import type { DependenciasDoPerguntar, EstimativaDaPergunta } from './perguntar.contratos.js';

const CARACTERES_DO_ENVELOPE_DO_ESTADO = 60;

// Antes de gastar: quantos comentários, quantos já têm resposta e quanto do plano a pergunta consome.
export async function estimarPergunta(
  dep: Pick<
    DependenciasDoPerguntar,
    'comentarios' | 'repositorio' | 'controleDeCusto' | 'maximoDeComentarios'
  >,
  contaId: ContaId,
  projetoId: ProjetoId,
  pergunta: PerguntaGravada,
): Promise<EstimativaDaPergunta> {
  const { total, alvos } = await dep.comentarios.alvosDaPergunta(
    contaId,
    projetoId,
    converterFiltros(pergunta.filtros),
    dep.maximoDeComentarios,
    MAX_CARACTERES_POR_COMENTARIO,
  );
  const ids = alvos.map((a) => a.id);
  const jaRespondidos = await dep.repositorio.contarReaproveitaveis(
    contaId,
    projetoId,
    pergunta,
    ids,
  );
  const definicao = (pergunta.instrucoes?.length ?? 0) + JSON.stringify(pergunta.criterios).length;
  const aAvaliar = alvos.slice(jaRespondidos);
  const estimativa = await dep.controleDeCusto.estimarConsumoDoPlano(
    contaId,
    aAvaliar.map((a) => ({
      provedor: 'jev' as const,
      caracteresEntrada: a.tamanho + definicao + CARACTERES_DO_ENVELOPE_DO_ESTADO,
    })),
  );
  return {
    totalAvaliar: alvos.length,
    foraDoLimite: total - alvos.length,
    jaRespondidos,
    porcentagemEstimada: estimativa.porcentagemEstimada,
    porcentagemJaConsumida: estimativa.porcentagemJaConsumida,
    cabe: estimativa.cabe,
  };
}
