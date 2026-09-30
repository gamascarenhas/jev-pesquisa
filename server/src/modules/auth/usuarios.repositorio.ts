import type { Banco, Executor } from '../../db/conexoes.js';
import { ehViolacaoDeUnicidade } from '../../db/erros-banco.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import { ErroDeConflito } from '../../shared/errors.js';
import { comoContaId, comoUsuarioId, type ContaId, type UsuarioId } from '../../shared/ids.js';
import type { Papel, Usuario, UsuarioComSenha } from './autenticacao.tipos.js';

export interface DadosNovoUsuario {
  nome: string;
  email: string;
  hashSenha: string;
  papel: Papel;
  emailConfirmadoEm: Date | null;
  termosAceitosEm: Date;
  versaoTermos: string;
}

export interface LinhaDeUsuario {
  id: string;
  conta_id: string;
  nome: string;
  email: string;
  email_confirmado_em: Date | null;
  papel: Papel;
  criado_em: Date;
  hash_senha: string;
  tentativas_login_falhas: number;
  bloqueado_ate: Date | null;
}

export const COLUNAS_DE_USUARIO = `id, conta_id, nome, email, email_confirmado_em, papel, criado_em,
  hash_senha, tentativas_login_falhas, bloqueado_ate`;

export function mapearUsuario(linha: LinhaDeUsuario): UsuarioComSenha {
  return {
    id: comoUsuarioId(linha.id),
    contaId: comoContaId(linha.conta_id),
    nome: linha.nome,
    email: linha.email,
    emailConfirmadoEm: linha.email_confirmado_em,
    papel: linha.papel,
    criadoEm: linha.criado_em,
    hashSenha: linha.hash_senha,
    tentativasLoginFalhas: linha.tentativas_login_falhas,
    bloqueadoAte: linha.bloqueado_ate,
  };
}

export function semSenha(usuario: UsuarioComSenha): Usuario {
  return {
    id: usuario.id,
    contaId: usuario.contaId,
    nome: usuario.nome,
    email: usuario.email,
    emailConfirmadoEm: usuario.emailConfirmadoEm,
    papel: usuario.papel,
    criadoEm: usuario.criadoEm,
  };
}

function traduzirConflitoDeEmail(erro: unknown): unknown {
  return ehViolacaoDeUnicidade(erro)
    ? new ErroDeConflito('Este e-mail já pertence a uma conta.', 'email_em_uso')
    : erro;
}

export class UsuariosRepositorio {
  constructor(private readonly banco: Banco) {}

  async criar(
    contaId: ContaId,
    dados: DadosNovoUsuario,
    executor: Executor = this.banco,
  ): Promise<Usuario> {
    try {
      const resultado = await executor.query<LinhaDeUsuario>(
        `INSERT INTO usuarios (conta_id, nome, email, email_confirmado_em, hash_senha, papel,
                               termos_aceitos_em, versao_termos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUNAS_DE_USUARIO}`,
        [
          contaId,
          dados.nome,
          dados.email,
          dados.emailConfirmadoEm,
          dados.hashSenha,
          dados.papel,
          dados.termosAceitosEm,
          dados.versaoTermos,
        ],
      );
      return semSenha(mapearUsuario(exigirPrimeiraLinha(resultado.rows)));
    } catch (erro) {
      throw traduzirConflitoDeEmail(erro);
    }
  }

  async buscarComSenha(
    contaId: ContaId,
    usuarioId: UsuarioId,
  ): Promise<UsuarioComSenha | undefined> {
    const resultado = await this.banco.query<LinhaDeUsuario>(
      `SELECT ${COLUNAS_DE_USUARIO} FROM usuarios WHERE conta_id = $1 AND id = $2`,
      [contaId, usuarioId],
    );
    const linha = resultado.rows[0];
    return linha && mapearUsuario(linha);
  }

  async buscarPorId(contaId: ContaId, usuarioId: UsuarioId): Promise<Usuario | undefined> {
    const usuario = await this.buscarComSenha(contaId, usuarioId);
    return usuario && semSenha(usuario);
  }

  async listar(contaId: ContaId): Promise<Usuario[]> {
    const resultado = await this.banco.query<LinhaDeUsuario>(
      `SELECT ${COLUNAS_DE_USUARIO} FROM usuarios WHERE conta_id = $1 ORDER BY criado_em, id`,
      [contaId],
    );
    return resultado.rows.map((linha) => semSenha(mapearUsuario(linha)));
  }

  async remover(
    contaId: ContaId,
    usuarioId: UsuarioId,
    executor: Executor = this.banco,
  ): Promise<boolean> {
    const resultado = await executor.query('DELETE FROM usuarios WHERE conta_id = $1 AND id = $2', [
      contaId,
      usuarioId,
    ]);
    return resultado.rowCount === 1;
  }

  async contarDonosBloqueando(contaId: ContaId, executor: Executor): Promise<number> {
    const resultado = await executor.query(
      `SELECT id FROM usuarios WHERE conta_id = $1 AND papel = 'owner' FOR UPDATE`,
      [contaId],
    );
    return resultado.rowCount ?? 0;
  }

  async atualizarSenha(
    contaId: ContaId,
    usuarioId: UsuarioId,
    hash: string,
    executor: Executor = this.banco,
  ): Promise<void> {
    await executor.query(
      `UPDATE usuarios
          SET hash_senha = $3, tentativas_login_falhas = 0, bloqueado_ate = NULL,
              atualizado_em = now()
        WHERE conta_id = $1 AND id = $2`,
      [contaId, usuarioId, hash],
    );
  }

  async confirmarEmail(
    contaId: ContaId,
    usuarioId: UsuarioId,
    agora: Date,
    executor: Executor = this.banco,
  ): Promise<void> {
    await executor.query(
      `UPDATE usuarios SET email_confirmado_em = $3, atualizado_em = now()
        WHERE conta_id = $1 AND id = $2 AND email_confirmado_em IS NULL`,
      [contaId, usuarioId, agora],
    );
  }

  async atualizarEmail(
    contaId: ContaId,
    usuarioId: UsuarioId,
    email: string,
    agora: Date,
    executor: Executor = this.banco,
  ): Promise<void> {
    try {
      await executor.query(
        `UPDATE usuarios SET email = $3, email_confirmado_em = $4, atualizado_em = now()
          WHERE conta_id = $1 AND id = $2`,
        [contaId, usuarioId, email, agora],
      );
    } catch (erro) {
      throw traduzirConflitoDeEmail(erro);
    }
  }

  async registrarLoginSucesso(contaId: ContaId, usuarioId: UsuarioId, agora: Date): Promise<void> {
    await this.banco.query(
      `UPDATE usuarios
          SET tentativas_login_falhas = 0, bloqueado_ate = NULL, ultimo_login_em = $3
        WHERE conta_id = $1 AND id = $2`,
      [contaId, usuarioId, agora],
    );
  }

  async registrarFalhaDeLogin(
    contaId: ContaId,
    usuarioId: UsuarioId,
    regra: { limite: number; bloqueadoAte: Date },
  ): Promise<void> {
    await this.banco.query(
      `UPDATE usuarios
          SET bloqueado_ate = CASE WHEN tentativas_login_falhas + 1 >= $3 THEN $4::timestamptz
                                   ELSE bloqueado_ate END,
              tentativas_login_falhas = CASE WHEN tentativas_login_falhas + 1 >= $3 THEN 0
                                             ELSE tentativas_login_falhas + 1 END
        WHERE conta_id = $1 AND id = $2`,
      [contaId, usuarioId, regra.limite, regra.bloqueadoAte],
    );
  }
}

export function criarUsuariosRepositorio(banco: Banco): UsuariosRepositorio {
  return new UsuariosRepositorio(banco);
}
