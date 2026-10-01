import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoProjetoId } from '../../shared/ids.js';
import {
  esquemaParametrosDoProjeto,
  paraEstimativaDto,
  paraInicioDto,
  paraProgressoDto,
} from './classificacao.esquemas.js';
import type { ClassificacaoServico } from './classificacao.servico.js';

export interface DependenciasClassificacaoRotas {
  servico: ClassificacaoServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirEmailConfirmado: preHandlerAsyncHookHandler;
}

const BASE = '/projetos/:projetoId/classificacao';

export function registrarRotasDeClassificacao(
  app: FastifyInstance,
  { servico, exigirAutenticacao, exigirEmailConfirmado }: DependenciasClassificacaoRotas,
): void {
  // Rotas que iniciam consumo de IA exigem e-mail confirmado; consultar o progresso não consome.
  const comIa = { preHandler: [exigirAutenticacao, exigirEmailConfirmado] };
  const semIa = { preHandler: [exigirAutenticacao] };

  app.get(`${BASE}/estimativa`, comIa, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    return paraEstimativaDto(await servico.estimar(contaId, comoProjetoId(projetoId)));
  });

  app.post(BASE, comIa, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const inicio = await servico.iniciar(contaId, usuarioId, comoProjetoId(projetoId));
    return resposta.status(inicio.jaExistia ? 200 : 202).send(paraInicioDto(inicio));
  });

  app.get(`${BASE}/progresso`, semIa, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    return paraProgressoDto(await servico.progresso(contaId, comoProjetoId(projetoId)));
  });

  app.post(`${BASE}/reprocessar-falhas`, comIa, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { projetoId } = esquemaParametrosDoProjeto.parse(requisicao.params);
    const inicio = await servico.reprocessarFalhas(contaId, usuarioId, comoProjetoId(projetoId));
    return resposta.status(inicio.jaExistia ? 200 : 202).send(paraInicioDto(inicio));
  });
}
