import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { FastifyInstance, FastifyRequest, Session } from 'fastify';

import type { Banco } from '../../db/conexoes.js';
import { ehViolacaoDeChaveEstrangeira } from '../../db/erros-banco.js';
import type { EncerradorDeSessoes } from '../../modules/auth/autenticacao.tipos.js';
import type { Relogio } from '../../shared/clock.js';
import type { ContaId, UsuarioId } from '../../shared/ids.js';

export const VALIDADE_SESSAO_OCIOSA_MS = 7 * 24 * 60 * 60 * 1000;
export const VALIDADE_SESSAO_ABSOLUTA_MS = 30 * 24 * 60 * 60 * 1000;
const NOME_COOKIE_DESENVOLVIMENTO = 'sessao';
const NOME_COOKIE_PRODUCAO = '__Host-sessao';

declare module 'fastify' {
  interface Session {
    usuarioId?: string;
    contaId?: string;
    criadaEm?: string;
  }
}

type Retorno = (erro?: unknown) => void;

function instanteDeCriacao(sessao: Session, agora: Date): Date {
  const criada = sessao.criadaEm === undefined ? agora : new Date(sessao.criadaEm);
  return Number.isNaN(criada.getTime()) ? agora : criada;
}

function limiteAbsoluto(sessao: Session, agora: Date): number {
  return instanteDeCriacao(sessao, agora).getTime() + VALIDADE_SESSAO_ABSOLUTA_MS;
}

function concluir(operacao: Promise<unknown>, retorno: Retorno): void {
  operacao.then(
    () => {
      retorno();
    },
    (erro: unknown) => {
      retorno(erro);
    },
  );
}

// Atravessa contas de propósito: a sessão é achada pelo id do cookie, antes de se saber a conta.
export class ArmazenamentoDeSessao implements EncerradorDeSessoes {
  constructor(
    private readonly banco: Banco,
    private readonly relogio: Relogio,
  ) {}

  set(idSessao: string, sessao: Session, retorno: Retorno): void {
    concluir(this.gravar(idSessao, sessao), retorno);
  }

  get(idSessao: string, retorno: (erro: unknown, sessao?: Session | null) => void): void {
    this.ler(idSessao).then(
      (sessao) => {
        retorno(null, sessao);
      },
      (erro: unknown) => {
        retorno(erro);
      },
    );
  }

  destroy(idSessao: string, retorno: Retorno): void {
    concluir(this.destruir(idSessao), retorno);
  }

  async encerrarDoUsuario(usuarioId: UsuarioId, exceto?: string): Promise<void> {
    await this.banco.query(
      'DELETE FROM sessoes WHERE usuario_id = $1 AND ($2::text IS NULL OR id_sessao <> $2)',
      [usuarioId, exceto ?? null],
    );
  }

  async encerrarDaConta(contaId: ContaId): Promise<void> {
    await this.banco.query(
      'DELETE FROM sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE conta_id = $1)',
      [contaId],
    );
  }

  private async gravar(idSessao: string, sessao: Session): Promise<void> {
    const agora = this.relogio.agora();
    const expiraEm = new Date(
      Math.min(agora.getTime() + VALIDADE_SESSAO_OCIOSA_MS, limiteAbsoluto(sessao, agora)),
    );
    try {
      await this.banco.query(
        `INSERT INTO sessoes (id_sessao, usuario_id, dados, expira_em) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_sessao) DO UPDATE
           SET usuario_id = EXCLUDED.usuario_id, dados = EXCLUDED.dados,
               expira_em = EXCLUDED.expira_em`,
        [idSessao, sessao.usuarioId ?? null, JSON.stringify(sessao), expiraEm],
      );
    } catch (erro) {
      // Usuário removido no meio da requisição: a sessão não deve mais existir.
      if (!ehViolacaoDeChaveEstrangeira(erro)) {
        throw erro;
      }
    }
  }

  private async ler(idSessao: string): Promise<Session | null> {
    const resultado = await this.banco.query<{ dados: Session; expira_em: Date }>(
      'SELECT dados, expira_em FROM sessoes WHERE id_sessao = $1',
      [idSessao],
    );
    const linha = resultado.rows[0];
    if (linha === undefined) {
      return null;
    }
    const agora = this.relogio.agora();
    if (linha.expira_em <= agora || limiteAbsoluto(linha.dados, agora) <= agora.getTime()) {
      await this.destruir(idSessao);
      return null;
    }
    return linha.dados;
  }

  private async destruir(idSessao: string): Promise<void> {
    await this.banco.query('DELETE FROM sessoes WHERE id_sessao = $1', [idSessao]);
  }
}

export function criarArmazenamentoDeSessao(banco: Banco, relogio: Relogio): ArmazenamentoDeSessao {
  return new ArmazenamentoDeSessao(banco, relogio);
}

export interface OpcoesDoPluginDeSessao {
  armazenamento: ArmazenamentoDeSessao;
  segredo: string;
  estaEmProducao: boolean;
}

export async function registrarSessao(
  app: FastifyInstance,
  opcoes: OpcoesDoPluginDeSessao,
): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: opcoes.segredo,
    store: opcoes.armazenamento,
    cookieName: opcoes.estaEmProducao ? NOME_COOKIE_PRODUCAO : NOME_COOKIE_DESENVOLVIMENTO,
    rolling: true,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: opcoes.estaEmProducao,
      path: '/',
      maxAge: VALIDADE_SESSAO_OCIOSA_MS,
    },
  });
}

export async function iniciarSessao(
  requisicao: FastifyRequest,
  identidade: { usuarioId: UsuarioId; contaId: ContaId },
  agora: Date,
): Promise<void> {
  await requisicao.session.regenerate();
  requisicao.session.set('usuarioId', identidade.usuarioId);
  requisicao.session.set('contaId', identidade.contaId);
  requisicao.session.set('criadaEm', agora.toISOString());
}
