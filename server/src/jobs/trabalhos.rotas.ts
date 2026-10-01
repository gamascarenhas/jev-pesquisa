import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../http/guards/exigir-autenticacao.js';
import { comoTrabalhoId } from '../shared/ids.js';
import { esquemaParametrosDeTrabalho, paraTrabalhoDto } from './trabalhos.esquemas.js';
import type { TrabalhosServico } from './trabalhos.servico.js';

export interface DependenciasTrabalhosRotas {
  servico: TrabalhosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDeTrabalhos(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasTrabalhosRotas,
): void {
  app.get('/trabalhos/:id', { preHandler: [exigirAutenticacao] }, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { id } = esquemaParametrosDeTrabalho.parse(requisicao.params);
    return paraTrabalhoDto(await servico.obter(contaId, comoTrabalhoId(id)));
  });
}
