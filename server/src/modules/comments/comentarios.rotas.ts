import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoComentarioId, comoProjetoId } from '../../shared/ids.js';
import { precisaDeAcao } from '../../shared/thresholds.js';
import {
  esquemaCorrecao,
  esquemaListagem,
  esquemaListagemDaFila,
  esquemaParametrosDoComentario,
  esquemaParametrosDoProjeto,
  paraComentarioDto,
} from './comentarios.esquemas.js';
import type { ComentarioListado, ComentariosServico } from './comentarios.servico.js';
import { converterFiltros } from './filtros-comentarios.js';

export interface DependenciasComentariosRotas {
  servico: ComentariosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

interface PaginaDeComentarios {
  itens: ComentarioListado[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

function paraPaginaDto(pagina: PaginaDeComentarios) {
  return { ...pagina, itens: pagina.itens.map((item) => paraComentarioDto(item, precisaDeAcao)) };
}

function rotasDeListagem(app: FastifyInstance, dep: DependenciasComentariosRotas): void {
  const opcoes = { preHandler: [dep.exigirAutenticacao] };

  app.get('/projetos/:projetoId/comentarios', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const { pagina, tamanhoPagina, ...filtros } = esquemaListagem.parse(requisicao.query);
    return paraPaginaDto(
      await dep.servico.listar(contaId, comoProjetoId(projetoId), converterFiltros(filtros), {
        pagina,
        tamanhoPagina,
      }),
    );
  });

  app.get('/projetos/:projetoId/revisao', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const paginacao = esquemaListagemDaFila.parse(requisicao.query);
    return paraPaginaDto(
      await dep.servico.listarFilaDeRevisao(contaId, comoProjetoId(projetoId), paginacao),
    );
  });
}

function rotaDeCorrecao(app: FastifyInstance, dep: DependenciasComentariosRotas): void {
  app.put(
    '/projetos/:projetoId/comentarios/:comentarioId/revisao',
    { preHandler: [dep.exigirAutenticacao] },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const { projetoId, comentarioId } = esquemaParametrosDoComentario.parse(requisicao.params);
      const { tema, sentimento } = esquemaCorrecao.parse(requisicao.body);
      await dep.servico.corrigir(
        contaId,
        usuarioId,
        comoProjetoId(projetoId),
        comoComentarioId(comentarioId),
        tema,
        sentimento,
      );
      return resposta.status(204).send();
    },
  );
}

export function registrarRotasDeComentarios(
  app: FastifyInstance,
  dependencias: DependenciasComentariosRotas,
): void {
  rotasDeListagem(app, dependencias);
  rotaDeCorrecao(app, dependencias);
}
