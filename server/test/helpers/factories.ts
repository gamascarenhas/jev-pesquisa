import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'dotenv';

import type { Banco } from '../../src/db/conexoes.js';
import type {
  EnviadorDeEmail,
  MensagemDeEmail,
} from '../../src/integrations/mail/enviador-email.js';
import type { StatusDeTrabalho, TipoDeTrabalho } from '../../src/jobs/trabalhos.tipos.js';
import { gerarHashDeSenha } from '../../src/modules/auth/senha.js';
import {
  comoContaId,
  comoComentarioId,
  comoFonteId,
  comoProjetoId,
  comoTrabalhoId,
  comoUsuarioId,
  type ComentarioId,
  type ContaId,
  type FonteId,
  type ProjetoId,
  type TrabalhoId,
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
  sobrescritas: {
    nome?: string;
    precoMensalCentavos?: number;
    limiteCustoIaUsd?: string;
    ativo?: boolean;
  } = {},
): Promise<string> {
  const id = `plano-teste-${gerarUuid()}`;
  await banco.query(
    `INSERT INTO planos (id, nome, preco_mensal_centavos, limite_custo_ia_usd, ativo)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      id,
      sobrescritas.nome ?? 'Plano de teste',
      sobrescritas.precoMensalCentavos ?? 0,
      sobrescritas.limiteCustoIaUsd ?? '1.000000',
      sobrescritas.ativo ?? true,
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

export async function criarTrabalhoDeTeste(
  banco: Banco,
  contaId: ContaId,
  sobrescritas: {
    projetoId?: ProjetoId;
    tipo?: TipoDeTrabalho;
    status?: StatusDeTrabalho;
    carga?: Record<string, unknown>;
    maxTentativas?: number;
    executarApos?: Date;
  } = {},
): Promise<TrabalhoId> {
  const resultado = await banco.query<{ id: string }>(
    `INSERT INTO trabalhos (conta_id, projeto_id, tipo, status, carga, max_tentativas, executar_apos)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now())) RETURNING id`,
    [
      contaId,
      sobrescritas.projetoId ?? null,
      sobrescritas.tipo ?? 'summarize',
      sobrescritas.status ?? 'pending',
      JSON.stringify(sobrescritas.carga ?? {}),
      sobrescritas.maxTentativas ?? 5,
      sobrescritas.executarApos ?? null,
    ],
  );
  return comoTrabalhoId(resultado.rows[0]?.id ?? '');
}

export async function criarFonteDeTeste(
  banco: Banco,
  contaId: ContaId,
  projetoId: ProjetoId,
  nome = 'planilha.csv',
): Promise<FonteId> {
  const resultado = await banco.query<{ id: string }>(
    "INSERT INTO fontes (conta_id, projeto_id, tipo, nome) VALUES ($1, $2, 'upload', $3) RETURNING id",
    [contaId, projetoId, nome],
  );
  return comoFonteId(resultado.rows[0]?.id ?? '');
}

export async function criarComentarioDeTeste(
  banco: Banco,
  contaId: ContaId,
  projetoId: ProjetoId,
  fonteId: FonteId,
  texto = `Comentário ${gerarUuid()}`,
  extras: {
    unidade?: string;
    autor?: string;
    nota?: number;
    comentadoEm?: Date;
  } = {},
): Promise<ComentarioId> {
  const resultado = await banco.query<{ id: string }>(
    `INSERT INTO comentarios (conta_id, projeto_id, fonte_id, texto_original, texto_mascarado, hash_conteudo,
                             nome_unidade, nome_autor, nota, comentado_em)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      contaId,
      projetoId,
      fonteId,
      texto,
      gerarUuid(),
      extras.unidade ?? null,
      extras.autor ?? null,
      extras.nota ?? null,
      extras.comentadoEm ?? null,
    ],
  );
  return comoComentarioId(resultado.rows[0]?.id ?? '');
}

export async function criarClassificacaoDeTeste(
  banco: Banco,
  contaId: ContaId,
  comentarioId: ComentarioId,
  usuarioId?: UsuarioId,
  sobrescritas: {
    tema?: string;
    sentimento?: string;
    gravidadePontuacao?: number;
    precisaAcao?: number;
    precisaRevisao?: boolean;
    temaConfianca?: number;
  } = {},
): Promise<void> {
  await banco.query(
    `INSERT INTO classificacoes
       (comentario_id, conta_id, modelo, tema, tema_confianca, tema_probabilidades, sentimento,
        sentimento_confianca, sentimento_probabilidades, gravidade_pontuacao, gravidade_normalizada,
        gravidade_confianca, gravidade_probabilidades, precisa_acao, precisa_revisao)
     VALUES ($1, $2, 'jev-teste', $3, $4, '{}', $5, 0.9, '{}', $6, $7, 0.8, '{}', $8, $9)`,
    [
      comentarioId,
      contaId,
      sobrescritas.tema ?? 'price',
      sobrescritas.temaConfianca ?? 0.9,
      sobrescritas.sentimento ?? 'negative',
      sobrescritas.gravidadePontuacao ?? 2,
      Math.min(1, (sobrescritas.gravidadePontuacao ?? 2) / 3),
      sobrescritas.precisaAcao ?? 0.8,
      sobrescritas.precisaRevisao ?? false,
    ],
  );
  await banco.query("UPDATE comentarios SET status_classificacao = 'done' WHERE id = $1", [
    comentarioId,
  ]);
  if (usuarioId !== undefined) {
    await banco.query(
      `INSERT INTO revisoes_classificacao (comentario_id, conta_id, tema, sentimento, revisado_por)
       VALUES ($1, $2, 'service', 'positive', $3)`,
      [comentarioId, contaId, usuarioId],
    );
  }
}

export async function criarLancamentoDeConsumoDeTeste(
  banco: Banco,
  contaId: ContaId,
  sobrescritas: {
    status?: 'reserved' | 'settled' | 'released';
    usd?: string;
    idadeEmMinutos?: number;
  } = {},
): Promise<void> {
  const status = sobrescritas.status ?? 'settled';
  const usd = sobrescritas.usd ?? '0.01000000';
  await banco.query(
    `INSERT INTO livro_razao_consumo
       (conta_id, conta_ref, ciclo_iniciado_em, provedor, operacao, tokens_entrada_estimados,
        reservado_usd, status, real_usd, criado_em)
     SELECT c.id, c.id, c.ciclo_iniciado_em, 'jev', 'classify', 100, $2::numeric, $3,
            CASE WHEN $3 = 'settled' THEN $2::numeric END, now() - make_interval(mins => $4)
       FROM contas c WHERE c.id = $1`,
    [contaId, usd, status, sobrescritas.idadeEmMinutos ?? 0],
  );
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
