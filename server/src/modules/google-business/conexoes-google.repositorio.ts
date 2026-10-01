import type { Banco } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import {
  comoContaId,
  comoProjetoId,
  comoUsuarioId,
  type ContaId,
  type ProjetoId,
  type UsuarioId,
} from '../../shared/ids.js';
import type { ConexaoGoogle, NovaConexaoGoogle } from './conexoes-google.tipos.js';

interface LinhaDeConexao {
  id: string;
  conta_id: string;
  projeto_id: string;
  email_conta_google: string;
  token_atualizacao_criptografado: string | null;
  token_acesso_criptografado: string | null;
  token_acesso_expira_em: Date | null;
  escopos: string[];
  conectado_por: string | null;
  revogado_em: Date | null;
}

const COLUNAS = `id, conta_id, projeto_id, email_conta_google, token_atualizacao_criptografado,
  token_acesso_criptografado, token_acesso_expira_em, escopos, conectado_por, revogado_em`;

function mapearConexao(linha: LinhaDeConexao): ConexaoGoogle {
  return {
    id: linha.id,
    contaId: comoContaId(linha.conta_id),
    projetoId: comoProjetoId(linha.projeto_id),
    email: linha.email_conta_google,
    tokenAtualizacaoCifrado: linha.token_atualizacao_criptografado,
    tokenAcessoCifrado: linha.token_acesso_criptografado,
    tokenAcessoExpiraEm: linha.token_acesso_expira_em,
    escopos: linha.escopos,
    conectadoPor: linha.conectado_por === null ? null : comoUsuarioId(linha.conectado_por),
    revogadoEm: linha.revogado_em,
  };
}

export class ConexoesGoogleRepositorio {
  constructor(private readonly banco: Banco) {}

  // O índice único parcial recusa uma segunda conexão ativa do mesmo projeto.
  async criar(
    contaId: ContaId,
    projetoId: ProjetoId,
    usuarioId: UsuarioId,
    nova: NovaConexaoGoogle,
  ): Promise<ConexaoGoogle> {
    const resultado = await this.banco.query<LinhaDeConexao>(
      `INSERT INTO conexoes_google
         (conta_id, projeto_id, email_conta_google, token_atualizacao_criptografado,
          token_acesso_criptografado, token_acesso_expira_em, escopos, conectado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLUNAS}`,
      [
        contaId,
        projetoId,
        nova.email,
        nova.tokenAtualizacaoCifrado,
        nova.tokenAcessoCifrado,
        nova.tokenAcessoExpiraEm,
        nova.escopos,
        usuarioId,
      ],
    );
    return mapearConexao(exigirPrimeiraLinha(resultado.rows));
  }

  async buscarAtiva(contaId: ContaId, projetoId: ProjetoId): Promise<ConexaoGoogle | undefined> {
    const resultado = await this.banco.query<LinhaDeConexao>(
      `SELECT ${COLUNAS} FROM conexoes_google
        WHERE conta_id = $1 AND projeto_id = $2 AND revogado_em IS NULL`,
      [contaId, projetoId],
    );
    const linha = resultado.rows[0];
    return linha && mapearConexao(linha);
  }

  async listarAtivasDaConta(contaId: ContaId): Promise<ConexaoGoogle[]> {
    const resultado = await this.banco.query<LinhaDeConexao>(
      `SELECT ${COLUNAS} FROM conexoes_google WHERE conta_id = $1 AND revogado_em IS NULL`,
      [contaId],
    );
    return resultado.rows.map(mapearConexao);
  }

  async gravarTokenDeAcesso(
    contaId: ContaId,
    conexaoId: string,
    tokenAcessoCifrado: string,
    expiraEm: Date,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE conexoes_google
          SET token_acesso_criptografado = $3, token_acesso_expira_em = $4, atualizado_em = now()
        WHERE conta_id = $1 AND id = $2 AND revogado_em IS NULL`,
      [contaId, conexaoId, tokenAcessoCifrado, expiraEm],
    );
  }

  // A linha fica como histórico, sem nenhum segredo.
  async revogar(contaId: ContaId, conexaoId: string, agora: Date): Promise<void> {
    await this.banco.query(
      `UPDATE conexoes_google
          SET revogado_em = $3, token_atualizacao_criptografado = NULL,
              token_acesso_criptografado = NULL, token_acesso_expira_em = NULL, atualizado_em = $3
        WHERE conta_id = $1 AND id = $2`,
      [contaId, conexaoId, agora],
    );
  }
}

export function criarConexoesGoogleRepositorio(banco: Banco): ConexoesGoogleRepositorio {
  return new ConexoesGoogleRepositorio(banco);
}
