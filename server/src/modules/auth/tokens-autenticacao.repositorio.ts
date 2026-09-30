import type { Banco, Executor } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import {
  comoContaId,
  comoTokenId,
  comoUsuarioId,
  type ContaId,
  type TokenId,
  type UsuarioId,
} from '../../shared/ids.js';
import type { Papel, TipoDeToken, TokenAutenticacao } from './autenticacao.tipos.js';

export interface DadosNovoToken {
  usuarioId: UsuarioId | null;
  tipo: TipoDeToken;
  email: string;
  hashToken: string;
  papelConvidado: Papel | null;
  criadoPor: UsuarioId | null;
  expiraEm: Date;
}

export interface LinhaDeToken {
  id: string;
  conta_id: string;
  usuario_id: string | null;
  tipo: TipoDeToken;
  email: string;
  papel_convidado: Papel | null;
  expira_em: Date;
  usado_em: Date | null;
  criado_em: Date;
}

export const COLUNAS_DE_TOKEN =
  'id, conta_id, usuario_id, tipo, email, papel_convidado, expira_em, usado_em, criado_em';

export function mapearToken(linha: LinhaDeToken): TokenAutenticacao {
  return {
    id: comoTokenId(linha.id),
    contaId: comoContaId(linha.conta_id),
    usuarioId: linha.usuario_id === null ? null : comoUsuarioId(linha.usuario_id),
    tipo: linha.tipo,
    email: linha.email,
    papelConvidado: linha.papel_convidado,
    expiraEm: linha.expira_em,
    usadoEm: linha.usado_em,
    criadoEm: linha.criado_em,
  };
}

export class TokensAutenticacaoRepositorio {
  constructor(private readonly banco: Banco) {}

  async criar(
    contaId: ContaId,
    dados: DadosNovoToken,
    executor: Executor = this.banco,
  ): Promise<TokenAutenticacao> {
    const resultado = await executor.query<LinhaDeToken>(
      `INSERT INTO tokens_autenticacao
         (conta_id, usuario_id, tipo, email, hash_token, papel_convidado, criado_por, expira_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUNAS_DE_TOKEN}`,
      [
        contaId,
        dados.usuarioId,
        dados.tipo,
        dados.email,
        dados.hashToken,
        dados.papelConvidado,
        dados.criadoPor,
        dados.expiraEm,
      ],
    );
    return mapearToken(exigirPrimeiraLinha(resultado.rows));
  }

  async apagarPendentesDoUsuario(
    contaId: ContaId,
    usuarioId: UsuarioId,
    tipo: TipoDeToken,
    executor: Executor = this.banco,
  ): Promise<void> {
    await executor.query(
      `DELETE FROM tokens_autenticacao
        WHERE conta_id = $1 AND usuario_id = $2 AND tipo = $3 AND usado_em IS NULL`,
      [contaId, usuarioId, tipo],
    );
  }

  async apagarConvitesPendentesDoEmail(
    contaId: ContaId,
    email: string,
    executor: Executor = this.banco,
  ): Promise<void> {
    await executor.query(
      `DELETE FROM tokens_autenticacao
        WHERE conta_id = $1 AND tipo = 'invitation' AND lower(email) = $2 AND usado_em IS NULL`,
      [contaId, email],
    );
  }

  async listarConvitesPendentes(contaId: ContaId, agora: Date): Promise<TokenAutenticacao[]> {
    const resultado = await this.banco.query<LinhaDeToken>(
      `SELECT ${COLUNAS_DE_TOKEN} FROM tokens_autenticacao
        WHERE conta_id = $1 AND tipo = 'invitation' AND usado_em IS NULL AND expira_em > $2
        ORDER BY criado_em DESC`,
      [contaId, agora],
    );
    return resultado.rows.map(mapearToken);
  }

  async apagarConvitePendente(contaId: ContaId, tokenId: TokenId): Promise<boolean> {
    const resultado = await this.banco.query(
      `DELETE FROM tokens_autenticacao
        WHERE conta_id = $1 AND id = $2 AND tipo = 'invitation' AND usado_em IS NULL`,
      [contaId, tokenId],
    );
    return resultado.rowCount === 1;
  }

  async consumir(
    contaId: ContaId,
    tokenId: TokenId,
    agora: Date,
    executor: Executor = this.banco,
  ): Promise<boolean> {
    const resultado = await executor.query(
      `UPDATE tokens_autenticacao SET usado_em = $3
        WHERE conta_id = $1 AND id = $2 AND usado_em IS NULL AND expira_em > $3`,
      [contaId, tokenId, agora],
    );
    return resultado.rowCount === 1;
  }
}

export function criarTokensAutenticacaoRepositorio(banco: Banco): TokensAutenticacaoRepositorio {
  return new TokensAutenticacaoRepositorio(banco);
}
