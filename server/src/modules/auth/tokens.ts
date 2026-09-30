import { createHash, randomBytes } from 'node:crypto';

const TAMANHO_TOKEN_BYTES = 32;

export interface TokenGerado {
  token: string;
  hashToken: string;
}

export function calcularHashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function gerarToken(): TokenGerado {
  const token = randomBytes(TAMANHO_TOKEN_BYTES).toString('base64url');
  return { token, hashToken: calcularHashDeToken(token) };
}
