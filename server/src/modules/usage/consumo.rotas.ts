import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import type { ControleDeCusto } from './controle-custo.servico.js';

const PORCENTAGEM_DO_LIMITE = 100;

const esquemaConsumoResposta = z
  .object({
    porcentagem: z.number(),
    limiteAtingido: z.boolean(),
    cicloTerminaEm: z.string(),
  })
  .strict();

export interface DependenciasConsumoRotas {
  servico: ControleDeCusto;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

// Só porcentagem do plano e a data de renovação: nunca dólar, token ou nome de modelo.
export function registrarRotasDeConsumo(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasConsumoRotas,
): void {
  app.get('/consumo', { preHandler: [exigirAutenticacao] }, async (requisicao) => {
    const consumo = await servico.consumoDoPlano(obterContexto(requisicao).contaId);
    return esquemaConsumoResposta.parse({
      porcentagem: consumo.porcentagem,
      limiteAtingido: consumo.porcentagem >= PORCENTAGEM_DO_LIMITE,
      cicloTerminaEm: consumo.cicloTerminaEm.toISOString(),
    });
  });
}
