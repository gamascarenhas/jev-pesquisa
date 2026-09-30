import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import { ErroMuitasRequisicoes } from '../../shared/errors.js';

export const LIMITE_GLOBAL_REQUISICOES = 300;
export const JANELA_LIMITE_REQUISICOES = '1 minute';

export interface RegraDeLimite {
  max: number;
  janela: string;
}

export const LIMITES = {
  cadastro: {
    porIp: { max: 10, janela: '1 hour' },
    porEmail: { max: 3, janela: '1 hour' },
  },
  reenvioConfirmacao: {
    porIp: { max: 10, janela: '1 hour' },
    porEmail: { max: 3, janela: '1 hour' },
  },
  redefinicaoSenha: {
    porIp: { max: 10, janela: '1 hour' },
    porEmail: { max: 3, janela: '1 hour' },
  },
  trocaEmail: {
    porIp: { max: 10, janela: '1 hour' },
    porEmail: { max: 3, janela: '1 hour' },
  },
  confirmacaoDeSenha: { max: 10, janela: '15 minutes' },
} as const satisfies Record<string, RegraDeLimite | Record<string, RegraDeLimite>>;

// Limite global por IP; os por rota entram com as rotas.
export async function registrarLimiteDeRequisicoes(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: LIMITE_GLOBAL_REQUISICOES,
    timeWindow: JANELA_LIMITE_REQUISICOES,
  });
}

export function limitePorIp(regra: RegraDeLimite): {
  config: { rateLimit: { max: number; timeWindow: string } };
} {
  return { config: { rateLimit: { max: regra.max, timeWindow: regra.janela } } };
}

function emailDoCorpo(requisicao: FastifyRequest): string | undefined {
  const corpo = requisicao.body;
  if (typeof corpo !== 'object' || corpo === null) {
    return undefined;
  }
  const valor = 'novoEmail' in corpo ? corpo.novoEmail : 'email' in corpo ? corpo.email : undefined;
  return typeof valor === 'string' ? valor.trim().toLowerCase() : undefined;
}

// createRateLimit em vez de app.rateLimit: este é ignorado quando o limite global já rodou na requisição.
function limitePorChave(
  app: FastifyInstance,
  nome: string,
  regra: RegraDeLimite,
  chave: (requisicao: FastifyRequest) => string,
): preHandlerAsyncHookHandler {
  const verificar = app.createRateLimit({
    max: regra.max,
    timeWindow: regra.janela,
    keyGenerator: (requisicao) => `${nome}:${chave(requisicao)}`,
  });
  return async (requisicao) => {
    const resultado = await verificar(requisicao);
    if (!resultado.isAllowed && resultado.isExceeded) {
      throw new ErroMuitasRequisicoes();
    }
  };
}

// Roda no preHandler, com o corpo já lido; sem e-mail no corpo, a chave cai para o IP.
export function limitePorEmail(
  app: FastifyInstance,
  nome: string,
  regra: RegraDeLimite,
): preHandlerAsyncHookHandler {
  return limitePorChave(
    app,
    nome,
    regra,
    (requisicao) => emailDoCorpo(requisicao) ?? requisicao.ip,
  );
}

// Chave por usuário logado, para rotas que pedem a senha de novo (freia adivinhação com sessão roubada).
export function limitePorUsuario(
  app: FastifyInstance,
  nome: string,
  regra: RegraDeLimite,
): preHandlerAsyncHookHandler {
  return limitePorChave(
    app,
    nome,
    regra,
    (requisicao) => requisicao.autenticacao?.usuarioId ?? requisicao.ip,
  );
}
