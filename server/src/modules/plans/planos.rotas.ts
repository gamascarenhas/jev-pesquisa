import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import type { PlanosServico } from './planos.servico.js';

const esquemaPlanosResposta = z
  .object({
    itens: z.array(
      z.object({ id: z.string(), nome: z.string(), precoMensalCentavos: z.number() }).strict(),
    ),
  })
  .strict();

export interface DependenciasPlanosRotas {
  servico: PlanosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDePlanos(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasPlanosRotas,
): void {
  app.get('/planos', { preHandler: [exigirAutenticacao] }, async () => {
    const planos = await servico.listar();
    return esquemaPlanosResposta.parse({
      itens: planos.map((plano) => ({
        id: plano.id,
        nome: plano.nome,
        precoMensalCentavos: plano.precoMensalCentavos,
      })),
    });
  });
}
