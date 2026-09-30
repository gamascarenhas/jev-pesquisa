import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export const LIMITE_GLOBAL_REQUISICOES = 300;
export const JANELA_LIMITE_REQUISICOES = '1 minute';

// Limite global por IP; os por rota entram com as rotas.
export async function registrarLimiteDeRequisicoes(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: LIMITE_GLOBAL_REQUISICOES,
    timeWindow: JANELA_LIMITE_REQUISICOES,
  });
}
