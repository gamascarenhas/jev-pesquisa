import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'dotenv';

import type { Banco } from '../../src/db/conexoes.js';
import { criarRegistrador, type Registrador } from '../../src/shared/logger.js';
import type { Relogio } from '../../src/shared/clock.js';

export const RAIZ_DO_REPOSITORIO = resolve(import.meta.dirname, '../../..');

export function lerExemploDeAmbiente(
  ambiente: 'development' | 'production',
): Record<string, string> {
  return parse(readFileSync(resolve(RAIZ_DO_REPOSITORIO, `.env.${ambiente}.example`)));
}

export function criarVariaveisDeProducaoValidas(): Record<string, string> {
  return {
    ...lerExemploDeAmbiente('production'),
    NOME_NEGOCIO: 'Negócio de Teste',
    SEGREDO_SESSAO: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    CHAVE_CRIPTOGRAFIA: Buffer.alloc(32, 7).toString('base64'),
    SMTP_SERVIDOR: 'smtp.exemplo.com.br',
    SMTP_PORTA: '587',
    SMTP_USUARIO: 'usuario',
    SMTP_SENHA: 'senha-de-teste',
    EMAIL_REMETENTE: 'nao-responda@exemplo.com.br',
    CHAVE_API_TYPESAFE: 'chave-typesafe-de-teste',
    LLM_CHAVE_API: 'chave-llm-de-teste',
    LLM_MODELO: 'modelo-de-teste',
    LLM_PRECO_ENTRADA_POR_MTOK: '1',
    LLM_PRECO_SAIDA_POR_MTOK: '5',
    GOOGLE_ID_CLIENTE: 'id-google-de-teste',
    GOOGLE_SEGREDO_CLIENTE: 'segredo-google-de-teste',
  };
}

export function criarRelogioFixo(instante: Date): Relogio {
  return { agora: () => new Date(instante) };
}

export function criarRegistradorCapturado(): {
  registrador: Registrador;
  linhas: () => Record<string, unknown>[];
  texto: () => string;
} {
  const brutas: string[] = [];
  const registrador = criarRegistrador({
    nivel: 'debug',
    legivel: false,
    destino: { write: (linha) => brutas.push(linha) },
  });
  return {
    registrador,
    linhas: () => brutas.map((linha) => JSON.parse(linha) as Record<string, unknown>),
    texto: () => brutas.join(''),
  };
}

export function gerarUuid(): string {
  return randomUUID();
}

export async function criarPlanoDeTeste(
  banco: Banco,
  sobrescritas: { nome?: string; precoMensalCentavos?: number; limiteCustoIaUsd?: string } = {},
): Promise<string> {
  const id = `plano-teste-${gerarUuid()}`;
  await banco.query(
    `INSERT INTO planos (id, nome, preco_mensal_centavos, limite_custo_ia_usd)
     VALUES ($1, $2, $3, $4)`,
    [
      id,
      sobrescritas.nome ?? 'Plano de teste',
      sobrescritas.precoMensalCentavos ?? 0,
      sobrescritas.limiteCustoIaUsd ?? '1.000000',
    ],
  );
  return id;
}
