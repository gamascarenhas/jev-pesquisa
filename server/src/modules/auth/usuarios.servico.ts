import { comTransacao } from '../../db/transacao.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { ErroDeConflito, ErroNaoEncontrado, ErroProibido } from '../../shared/errors.js';
import type { ContaId, UsuarioId } from '../../shared/ids.js';
import type { Usuario } from './autenticacao.tipos.js';
import type { DependenciasDeAuth } from './dependencias.js';
import { verificarSenha } from './senha.js';

export interface UsuariosServico {
  listar(contaId: ContaId): Promise<Usuario[]>;
  remover(contaId: ContaId, executorId: UsuarioId, alvoId: UsuarioId): Promise<void>;
  conferirSenha(contaId: ContaId, usuarioId: UsuarioId, senha: string): Promise<void>;
}

export function criarUsuariosServico(dep: DependenciasDeAuth): UsuariosServico {
  return {
    listar: (contaId) => dep.usuarios.listar(contaId),
    remover: (contaId, executorId, alvoId) => remover(dep, contaId, executorId, alvoId),
    conferirSenha: (contaId, usuarioId, senha) => conferirSenha(dep, contaId, usuarioId, senha),
  };
}

export async function conferirSenha(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  usuarioId: UsuarioId,
  senha: string,
): Promise<void> {
  const usuario = await dep.usuarios.buscarComSenha(contaId, usuarioId);
  const confere = usuario !== undefined && (await verificarSenha(usuario.hashSenha, senha));
  if (!confere) {
    throw new ErroProibido('Senha incorreta.', 'senha_incorreta');
  }
}

async function remover(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  executorId: UsuarioId,
  alvoId: UsuarioId,
): Promise<void> {
  if (alvoId === executorId) {
    throw new ErroDeConflito('Você não pode remover a si mesmo.', 'remocao_propria');
  }
  await comTransacao(dep.banco, async (cliente) => {
    const totalDeDonos = await dep.usuarios.contarDonosBloqueando(contaId, cliente);
    const alvo = await dep.usuarios.buscarPorId(contaId, alvoId);
    if (alvo === undefined) {
      throw new ErroNaoEncontrado('Usuário não encontrado.', 'usuario_nao_encontrado');
    }
    if (alvo.papel === 'owner' && totalDeDonos <= 1) {
      throw new ErroDeConflito('A conta precisa de ao menos um owner.', 'ultimo_owner');
    }
    // As sessões do usuário saem junto, por ON DELETE CASCADE em sessoes.
    await dep.usuarios.remover(contaId, alvoId, cliente);
  });
  registrarAuditoria(dep.registrador, 'usuario_removido', {
    contaId,
    usuarioId: executorId,
    alvoId,
  });
}
