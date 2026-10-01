import type { Banco, Executor } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import { comoContaId, type ContaId } from '../../shared/ids.js';
import type { TokenAutenticacao, UsuarioComSenha } from './autenticacao.tipos.js';
import {
  COLUNAS_DE_TOKEN,
  mapearToken,
  type LinhaDeToken,
} from './tokens-autenticacao.repositorio.js';
import { COLUNAS_DE_USUARIO, mapearUsuario, type LinhaDeUsuario } from './usuarios.repositorio.js';

export class AutenticacaoSistemaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Atravessa contas: o login só tem o e-mail, e ele é único no sistema.
  async buscarUsuarioPorEmail(email: string): Promise<UsuarioComSenha | undefined> {
    const resultado = await this.banco.query<LinhaDeUsuario>(
      `SELECT ${COLUNAS_DE_USUARIO} FROM usuarios WHERE lower(email) = $1`,
      [email],
    );
    const linha = resultado.rows[0];
    return linha && mapearUsuario(linha);
  }

  // Atravessa contas: o e-mail é único no sistema, então a checagem vale para todas.
  async existeUsuarioComEmail(email: string, executor: Executor = this.banco): Promise<boolean> {
    const resultado = await executor.query('SELECT 1 FROM usuarios WHERE lower(email) = $1', [
      email,
    ]);
    return (resultado.rowCount ?? 0) > 0;
  }

  // Atravessa contas: quem abre o link de e-mail ainda não tem sessão; a conta vem do token.
  async buscarTokenPorHash(
    hashToken: string,
    executor: Executor = this.banco,
  ): Promise<TokenAutenticacao | undefined> {
    const resultado = await executor.query<LinhaDeToken>(
      `SELECT ${COLUNAS_DE_TOKEN} FROM tokens_autenticacao WHERE hash_token = $1`,
      [hashToken],
    );
    const linha = resultado.rows[0];
    return linha && mapearToken(linha);
  }

  // Atravessa contas: a limpeza agendada apaga tokens vencidos de todas as contas.
  async apagarTokensExpirados(agora: Date): Promise<number> {
    const resultado = await this.banco.query(
      'DELETE FROM tokens_autenticacao WHERE expira_em <= $1',
      [agora],
    );
    return resultado.rowCount ?? 0;
  }

  // Cria a própria conta, que ainda não existe, então não há contaId a filtrar.
  async criarConta(
    dados: { nome: string; planoId: string },
    executor: Executor = this.banco,
  ): Promise<ContaId> {
    const resultado = await executor.query<{ id: string }>(
      'INSERT INTO contas (nome, plano_id) VALUES ($1, $2) RETURNING id',
      [dados.nome, dados.planoId],
    );
    return comoContaId(exigirPrimeiraLinha(resultado.rows).id);
  }
}

export function criarAutenticacaoSistemaRepositorio(banco: Banco): AutenticacaoSistemaRepositorio {
  return new AutenticacaoSistemaRepositorio(banco);
}
