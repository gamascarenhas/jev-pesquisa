import { comTransacao } from '../../db/transacao.js';
import { montarEmailDeTrocaDeEmail } from '../../integrations/mail/templates/troca-email.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { ErroDeValidacao } from '../../shared/errors.js';
import type { ContaId, UsuarioId } from '../../shared/ids.js';
import type { DependenciasDeAuth } from './dependencias.js';
import { gerarHashDeSenha } from './senha.js';
import { conferirSenha } from './usuarios.servico.js';

export interface PerfilServico {
  trocarSenha(
    contaId: ContaId,
    usuarioId: UsuarioId,
    entrada: { senhaAtual: string; novaSenha: string },
    idSessaoAtual: string,
  ): Promise<void>;
  solicitarTrocaDeEmail(
    contaId: ContaId,
    usuarioId: UsuarioId,
    entrada: { novoEmail: string; senha: string },
  ): Promise<void>;
  confirmarTrocaDeEmail(token: string): Promise<void>;
}

export function criarPerfilServico(dep: DependenciasDeAuth): PerfilServico {
  return {
    trocarSenha: (contaId, usuarioId, entrada, idSessaoAtual) =>
      trocarSenha(dep, contaId, usuarioId, entrada, idSessaoAtual),
    solicitarTrocaDeEmail: (contaId, usuarioId, entrada) =>
      solicitarTrocaDeEmail(dep, contaId, usuarioId, entrada),
    confirmarTrocaDeEmail: (token) => confirmarTrocaDeEmail(dep, token),
  };
}

async function trocarSenha(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  usuarioId: UsuarioId,
  entrada: { senhaAtual: string; novaSenha: string },
  idSessaoAtual: string,
): Promise<void> {
  await conferirSenha(dep, contaId, usuarioId, entrada.senhaAtual);
  await dep.usuarios.atualizarSenha(contaId, usuarioId, await gerarHashDeSenha(entrada.novaSenha));
  await dep.encerradorDeSessoes.encerrarDoUsuario(usuarioId, idSessaoAtual);
  registrarAuditoria(dep.registrador, 'senha_trocada', { contaId, usuarioId });
}

async function solicitarTrocaDeEmail(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  usuarioId: UsuarioId,
  entrada: { novoEmail: string; senha: string },
): Promise<void> {
  await conferirSenha(dep, contaId, usuarioId, entrada.senha);
  const usuario = await dep.usuarios.buscarPorId(contaId, usuarioId);
  if (usuario === undefined || usuario.email.toLowerCase() === entrada.novoEmail) {
    return;
  }
  const { nomeNegocio } = dep.configuracao;
  if (await dep.sistema.existeUsuarioComEmail(entrada.novoEmail)) {
    dep.gestorDeTokens.avisarContaExistente(entrada.novoEmail);
    return;
  }
  const token = await dep.gestorDeTokens.emitir(contaId, {
    tipo: 'email_change',
    email: entrada.novoEmail,
    usuarioId,
  });
  dep.gestorDeTokens.enviar({
    para: entrada.novoEmail,
    ...montarEmailDeTrocaDeEmail({
      nomeNegocio,
      nomeUsuario: usuario.nome,
      link: dep.gestorDeTokens.montarLink('/confirmar-novo-email', token),
    }),
  });
}

async function confirmarTrocaDeEmail(dep: DependenciasDeAuth, tokenTextual: string): Promise<void> {
  const token = await dep.gestorDeTokens.localizar(tokenTextual, 'email_change');
  if (token.usuarioId === null) {
    throw new ErroDeValidacao('Link inválido, expirado ou já usado.', 'link_invalido');
  }
  const usuarioId = token.usuarioId;
  await comTransacao(dep.banco, async (cliente) => {
    await dep.gestorDeTokens.consumir(token, cliente);
    await dep.usuarios.atualizarEmail(
      token.contaId,
      usuarioId,
      token.email,
      dep.relogio.agora(),
      cliente,
    );
  });
  registrarAuditoria(dep.registrador, 'email_trocado', { contaId: token.contaId, usuarioId });
}
