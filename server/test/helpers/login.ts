import type { LightMyRequestResponse } from 'fastify';

import type { AppDeTeste } from './build-app.js';
import { SENHA_DE_TESTE } from './factories.js';

export interface OpcoesDeRequisicao {
  metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  cookie?: string;
  corpo?: unknown;
  corpoBruto?: Buffer;
  ip?: string;
  cabecalhos?: Record<string, string>;
}

export async function chamar(
  aplicacao: AppDeTeste,
  opcoes: OpcoesDeRequisicao,
): Promise<LightMyRequestResponse> {
  return aplicacao.app.inject({
    method: opcoes.metodo,
    url: opcoes.url,
    headers: {
      origin: aplicacao.configuracao.origemApp,
      ...(opcoes.cookie === undefined ? {} : { cookie: opcoes.cookie }),
      ...opcoes.cabecalhos,
    },
    ...(opcoes.corpo === undefined ? {} : { payload: opcoes.corpo as object }),
    ...(opcoes.corpoBruto === undefined ? {} : { payload: opcoes.corpoBruto }),
    ...(opcoes.ip === undefined ? {} : { remoteAddress: opcoes.ip }),
  });
}

export function cookieDaResposta(resposta: LightMyRequestResponse): string {
  const cookie = resposta.cookies[0];
  if (cookie === undefined) {
    throw new Error(`A resposta ${String(resposta.statusCode)} não trouxe cookie de sessão.`);
  }
  return `${cookie.name}=${cookie.value}`;
}

export async function entrar(
  aplicacao: AppDeTeste,
  email: string,
  senha: string = SENHA_DE_TESTE,
): Promise<string> {
  const resposta = await chamar(aplicacao, {
    metodo: 'POST',
    url: '/api/auth/login',
    corpo: { email, senha },
  });
  if (resposta.statusCode !== 200) {
    throw new Error(`Login de teste falhou com ${String(resposta.statusCode)}: ${resposta.body}`);
  }
  return cookieDaResposta(resposta);
}
