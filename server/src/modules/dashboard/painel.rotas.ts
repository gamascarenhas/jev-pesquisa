import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { Readable } from 'node:stream';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoProjetoId } from '../../shared/ids.js';
import { converterFiltros, esquemaFiltrosDeComentarios } from '../comments/comentarios.servico.js';
import type { ExportacaoServico } from './exportacao.servico.js';
import type { PainelServico } from './painel.servico.js';
import { esquemaParametrosDoPainel } from './painel.esquemas.js';

export interface DependenciasPainelRotas {
  painel: PainelServico;
  exportacao: ExportacaoServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDoPainel(
  app: FastifyInstance,
  { painel, exportacao, exigirAutenticacao }: DependenciasPainelRotas,
): void {
  const opcoes = { preHandler: [exigirAutenticacao] };

  app.get('/projetos/:projetoId/painel', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoPainel.parse(requisicao.params);
    const filtros = converterFiltros(esquemaFiltrosDeComentarios.parse(requisicao.query));
    return painel.consultar(contaId, comoProjetoId(projetoId), filtros);
  });

  app.get('/projetos/:projetoId/painel/opcoes', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoPainel.parse(requisicao.params);
    return painel.opcoes(contaId, comoProjetoId(projetoId));
  });

  app.get('/projetos/:projetoId/exportacao', opcoes, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoPainel.parse(requisicao.params);
    const filtros = converterFiltros(esquemaFiltrosDeComentarios.parse(requisicao.query));
    const arquivo = await exportacao.exportar(
      contaId,
      usuarioId,
      comoProjetoId(projetoId),
      filtros,
    );
    return resposta
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${arquivo.nomeDoArquivo}"`)
      .send(Readable.from(arquivo.conteudo));
  });
}
