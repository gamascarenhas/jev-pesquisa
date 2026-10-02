import { Readable } from 'node:stream';

import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoProjetoId } from '../../shared/ids.js';
import { converterFiltros } from '../comments/comentarios.servico.js';
import {
  esquemaConsultaDaExportacao,
  esquemaConsultaDoResultado,
  esquemaNovaPergunta,
  esquemaParametrosDaPergunta,
  esquemaParametrosDoProjeto,
  paraPerguntaComConfirmacaoDto,
  paraPerguntaDto,
  paraResultadoDto,
} from './perguntar.esquemas.js';
import type { PerguntarServico } from './perguntar.servico.js';

export interface DependenciasPerguntarRotas {
  servico: PerguntarServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirEmailConfirmado: preHandlerAsyncHookHandler;
}

const BASE = '/projetos/:projetoId/perguntas';

// Interpretar e confirmar consomem IA e exigem e-mail confirmado.
function rotasQueConsomemIa(app: FastifyInstance, dep: DependenciasPerguntarRotas): void {
  const comIa = { preHandler: [dep.exigirAutenticacao, dep.exigirEmailConfirmado] };

  app.post(BASE, comIa, async (requisicao) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const entrada = esquemaNovaPergunta.parse(requisicao.body);
    const resultado = await dep.servico.interpretar(contaId, usuarioId, comoProjetoId(projetoId), {
      texto: entrada.texto,
      filtros: entrada.filtros,
    });
    return paraPerguntaComConfirmacaoDto(resultado);
  });

  app.post(`${BASE}/:perguntaId/confirmar`, comIa, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { projetoId, perguntaId } = esquemaParametrosDaPergunta.parse(requisicao.params);
    const inicio = await dep.servico.confirmar(
      contaId,
      usuarioId,
      comoProjetoId(projetoId),
      perguntaId,
    );
    return resposta.status(inicio.jaExistia ? 200 : 202).send({ trabalhoId: inicio.trabalhoId });
  });
}

function rotasDeConsulta(app: FastifyInstance, dep: DependenciasPerguntarRotas): void {
  const opcoes = { preHandler: [dep.exigirAutenticacao] };

  app.get(BASE, opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const perguntas = await dep.servico.listar(contaId, comoProjetoId(projetoId));
    return { itens: perguntas.map(paraPerguntaDto) };
  });

  app.get(`${BASE}/:perguntaId`, opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId, perguntaId } = esquemaParametrosDaPergunta.parse(requisicao.params);
    return paraPerguntaComConfirmacaoDto(
      await dep.servico.obter(contaId, comoProjetoId(projetoId), perguntaId),
    );
  });

  app.get(`${BASE}/:perguntaId/resultado`, opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId, perguntaId } = esquemaParametrosDaPergunta.parse(requisicao.params);
    const { faixa, pagina, tamanhoPagina, ...filtros } = esquemaConsultaDoResultado.parse(
      requisicao.query,
    );
    const resultado = await dep.servico.resultado(
      contaId,
      comoProjetoId(projetoId),
      perguntaId,
      converterFiltros(filtros),
      faixa,
      { pagina, tamanhoPagina },
    );
    return paraResultadoDto(resultado, { pagina, tamanhoPagina });
  });

  app.get(`${BASE}/:perguntaId/exportacao`, opcoes, async (requisicao, resposta) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId, perguntaId } = esquemaParametrosDaPergunta.parse(requisicao.params);
    const { faixa, ...filtros } = esquemaConsultaDaExportacao.parse(requisicao.query);
    const arquivo = await dep.servico.exportar(
      contaId,
      comoProjetoId(projetoId),
      perguntaId,
      converterFiltros(filtros),
      faixa,
    );
    return resposta
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${arquivo.nomeDoArquivo}"`)
      .send(Readable.from(arquivo.conteudo));
  });
}

export function registrarRotasDePerguntar(
  app: FastifyInstance,
  dep: DependenciasPerguntarRotas,
): void {
  rotasQueConsomemIa(app, dep);
  rotasDeConsulta(app, dep);
}
