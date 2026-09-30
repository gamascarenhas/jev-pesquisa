import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'dotenv';

import type { Banco } from '../../src/db/conexoes.js';
import type {
  EnviadorDeEmail,
  MensagemDeEmail,
} from '../../src/integrations/mail/enviador-email.js';
import { gerarHashDeSenha } from '../../src/modules/auth/senha.js';
import {
  comoContaId,
  comoProjetoId,
  comoUsuarioId,
  type ContaId,
  type ProjetoId,
  type UsuarioId,
} from '../../src/shared/ids.js';
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

export const SENHA_DE_TESTE = 'senha-de-teste-123';

let hashDaSenhaDeTeste: Promise<string> | undefined;

export interface UsuarioDeTeste {
  id: UsuarioId;
  contaId: ContaId;
  email: string;
  senha: string;
}

export async function criarContaDeTeste(
  banco: Banco,
  sobrescritas: { nome?: string; planoId?: string } = {},
): Promise<ContaId> {
  const resultado = await banco.query<{ id: string }>(
    'INSERT INTO contas (nome, plano_id) VALUES ($1, $2) RETURNING id',
    [sobrescritas.nome ?? `Empresa ${gerarUuid()}`, sobrescritas.planoId ?? 'trial'],
  );
  return comoContaId(resultado.rows[0]?.id ?? '');
}

// A senha padrão é a mesma em quase todos os testes; o argon2 só roda uma vez para ela.
function obterHashDaSenha(senha: string | undefined): Promise<string> {
  if (senha !== undefined) {
    return gerarHashDeSenha(senha);
  }
  hashDaSenhaDeTeste ??= gerarHashDeSenha(SENHA_DE_TESTE);
  return hashDaSenhaDeTeste;
}

export async function criarUsuarioDeTeste(
  banco: Banco,
  contaId: ContaId,
  sobrescritas: {
    email?: string;
    senha?: string;
    papel?: 'owner' | 'member';
    emailConfirmado?: boolean;
    nome?: string;
  } = {},
): Promise<UsuarioDeTeste> {
  const senha = sobrescritas.senha ?? SENHA_DE_TESTE;
  const hash = await obterHashDaSenha(sobrescritas.senha);
  const email = sobrescritas.email ?? `usuario-${gerarUuid()}@exemplo.com.br`;
  const resultado = await banco.query<{ id: string }>(
    `INSERT INTO usuarios (conta_id, nome, email, email_confirmado_em, hash_senha, papel,
                           termos_aceitos_em, versao_termos)
     VALUES ($1, $2, $3, $4, $5, $6, now(), '1') RETURNING id`,
    [
      contaId,
      sobrescritas.nome ?? 'Usuário de Teste',
      email,
      sobrescritas.emailConfirmado === false ? null : new Date(),
      hash,
      sobrescritas.papel ?? 'owner',
    ],
  );
  return { id: comoUsuarioId(resultado.rows[0]?.id ?? ''), contaId, email, senha };
}

export async function criarContaComDonoDeTeste(
  banco: Banco,
  sobrescritas: { emailConfirmado?: boolean } = {},
): Promise<UsuarioDeTeste> {
  const contaId = await criarContaDeTeste(banco);
  return criarUsuarioDeTeste(banco, contaId, { papel: 'owner', ...sobrescritas });
}

export async function criarProjetoDeTeste(
  banco: Banco,
  contaId: ContaId,
  sobrescritas: { nome?: string; criadoPor?: UsuarioId } = {},
): Promise<ProjetoId> {
  const resultado = await banco.query<{ id: string }>(
    'INSERT INTO projetos (conta_id, nome, criado_por) VALUES ($1, $2, $3) RETURNING id',
    [contaId, sobrescritas.nome ?? 'Projeto de teste', sobrescritas.criadoPor ?? null],
  );
  return comoProjetoId(resultado.rows[0]?.id ?? '');
}

export interface EnviadorEmMemoria extends EnviadorDeEmail {
  enviadas: MensagemDeEmail[];
  paraEndereco(email: string): MensagemDeEmail[];
  tokenDaUltimaMensagem(email: string): string;
}

export function criarEnviadorEmMemoria(): EnviadorEmMemoria {
  const enviadas: MensagemDeEmail[] = [];
  const paraEndereco = (email: string): MensagemDeEmail[] =>
    enviadas.filter((mensagem) => mensagem.para === email);
  return {
    enviadas,
    paraEndereco,
    enviar: (mensagem) => {
      enviadas.push(mensagem);
      return Promise.resolve();
    },
    tokenDaUltimaMensagem: (email) => {
      const ultima = paraEndereco(email).at(-1);
      const token = /token=([\w-]+)/.exec(ultima?.texto ?? '')?.[1];
      if (token === undefined) {
        throw new Error(`Nenhum e-mail com link enviado para ${email}.`);
      }
      return token;
    },
  };
}
