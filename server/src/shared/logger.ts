import type { FastifyBaseLogger } from 'fastify';
import { pino } from 'pino';

// Mesmo tipo do Fastify, para app e plugins.
export type Registrador = FastifyBaseLogger;

export interface OpcoesRegistrador {
  nivel: string;
  legivel: boolean;
  destino?: { write(linha: string): void };
}

// Vale na raiz e em um nível de aninhamento.
const CAMPOS_SENSIVEIS = [
  'authorization',
  'cookie',
  'senha',
  'hash_senha',
  'token',
  'access_token',
  'refresh_token',
  'texto_original',
  'texto_mascarado',
  'segredo',
  'chave',
  'chaveApi',
];

export const CAMINHOS_REDIGIDOS = [
  ...CAMPOS_SENSIVEIS,
  ...CAMPOS_SENSIVEIS.map((campo) => `*.${campo}`),
  ...CAMPOS_SENSIVEIS.map((campo) => `req.headers.${campo}`),
  ...CAMPOS_SENSIVEIS.map((campo) => `res.headers.${campo}`),
  'res.headers["set-cookie"]',
];

export function criarRegistrador(opcoes: OpcoesRegistrador): Registrador {
  const base = {
    level: opcoes.nivel,
    redact: { paths: CAMINHOS_REDIGIDOS, censor: '[REDIGIDO]' },
  };
  if (opcoes.destino) {
    return pino(base, opcoes.destino);
  }
  if (opcoes.legivel) {
    return pino({ ...base, transport: { target: 'pino-pretty', options: { colorize: true } } });
  }
  return pino(base);
}
