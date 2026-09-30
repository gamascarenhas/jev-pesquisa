import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import type { ContasServico } from './contas.servico.js';

const esquemaContaResposta = z
  .object({
    id: z.string(),
    nome: z.string(),
    plano: z.object({ id: z.string(), nome: z.string() }).strict(),
    cicloTerminaEm: z.string(),
  })
  .strict();

export interface DependenciasContasRotas {
  servico: ContasServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDeContas(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasContasRotas,
): void {
  app.get('/conta', { preHandler: [exigirAutenticacao] }, async (requisicao) => {
    const conta = await servico.obter(obterContexto(requisicao).contaId);
    return esquemaContaResposta.parse({
      id: conta.id,
      nome: conta.nome,
      plano: { id: conta.planoId, nome: conta.planoNome },
      cicloTerminaEm: conta.cicloTerminaEm.toISOString(),
    });
  });
}
