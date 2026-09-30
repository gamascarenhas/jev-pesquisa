import { comTransacao } from '../../db/transacao.js';
import { montarEmailDeConfirmacao } from '../../integrations/mail/templates/confirmacao-email.js';
import { montarEmailDeRedefinicaoDeSenha } from '../../integrations/mail/templates/redefinicao-senha.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import {
  ErroDeConflito,
  ErroDeValidacao,
  ErroNaoAutenticado,
  ErroNaoEncontrado,
} from '../../shared/errors.js';
import type { ContaId, UsuarioId } from '../../shared/ids.js';
import type {
  ContextoAutenticado,
  TokenAutenticacao,
  Usuario,
  UsuarioComSenha,
} from './autenticacao.tipos.js';
import type { DependenciasDeAuth } from './dependencias.js';
import { gerarHashDeSenha, simularVerificacaoDeSenha, verificarSenha } from './senha.js';
import { semSenha } from './usuarios.repositorio.js';

export const LIMITE_TENTATIVAS_LOGIN = 5;
export const DURACAO_BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;

export interface EntradaDeCadastro {
  nomeEmpresa: string;
  nomeUsuario: string;
  email: string;
  senha: string;
}

export interface AutenticacaoServico {
  cadastrar(entrada: EntradaDeCadastro): Promise<void>;
  entrar(email: string, senha: string): Promise<Usuario>;
  confirmarEmail(token: string): Promise<void>;
  reenviarConfirmacao(email: string): Promise<void>;
  solicitarRedefinicao(email: string): Promise<void>;
  redefinirSenha(token: string, novaSenha: string): Promise<void>;
  obterUsuario(contaId: ContaId, usuarioId: UsuarioId): Promise<Usuario>;
  carregarContexto(
    contaId: ContaId,
    usuarioId: UsuarioId,
  ): Promise<ContextoAutenticado | undefined>;
}

export function criarAutenticacaoServico(dep: DependenciasDeAuth): AutenticacaoServico {
  return {
    cadastrar: (entrada) => cadastrar(dep, entrada),
    entrar: (email, senha) => entrar(dep, email, senha),
    confirmarEmail: (token) => confirmarEmail(dep, token),
    reenviarConfirmacao: (email) => reenviarConfirmacao(dep, email),
    solicitarRedefinicao: (email) => solicitarRedefinicao(dep, email),
    redefinirSenha: (token, novaSenha) => redefinirSenha(dep, token, novaSenha),
    obterUsuario: (contaId, usuarioId) => obterUsuario(dep, contaId, usuarioId),
    carregarContexto: (contaId, usuarioId) => carregarContexto(dep, contaId, usuarioId),
  };
}

function usuarioDoToken(token: TokenAutenticacao): UsuarioId {
  if (token.usuarioId === null) {
    throw new ErroDeValidacao('Link inválido, expirado ou já usado.', 'link_invalido');
  }
  return token.usuarioId;
}

async function cadastrar(dep: DependenciasDeAuth, entrada: EntradaDeCadastro): Promise<void> {
  const hashSenha = await gerarHashDeSenha(entrada.senha);
  const resultado = await criarContaDoCadastro(dep, entrada, hashSenha);
  const { nomeNegocio } = dep.configuracao;
  if (resultado === 'existente') {
    dep.gestorDeTokens.avisarContaExistente(entrada.email);
    return;
  }
  dep.gestorDeTokens.enviar({
    para: entrada.email,
    ...montarEmailDeConfirmacao({
      nomeNegocio,
      nomeUsuario: entrada.nomeUsuario,
      link: dep.gestorDeTokens.montarLink('/confirmar-email', resultado.token),
    }),
  });
}

async function criarContaDoCadastro(
  dep: DependenciasDeAuth,
  entrada: EntradaDeCadastro,
  hashSenha: string,
): Promise<{ token: string } | 'existente'> {
  try {
    return await comTransacao(dep.banco, async (cliente) => {
      if (await dep.sistema.existeUsuarioComEmail(entrada.email, cliente)) {
        return 'existente';
      }
      const contaId = await dep.sistema.criarConta(
        { nome: entrada.nomeEmpresa, planoId: dep.configuracao.planoPadraoId },
        cliente,
      );
      const usuario = await dep.usuarios.criar(
        contaId,
        {
          nome: entrada.nomeUsuario,
          email: entrada.email,
          hashSenha,
          papel: 'owner',
          emailConfirmadoEm: null,
          termosAceitosEm: dep.relogio.agora(),
          versaoTermos: dep.configuracao.versaoTermos,
        },
        cliente,
      );
      const token = await dep.gestorDeTokens.emitir(
        contaId,
        { tipo: 'email_verification', email: entrada.email, usuarioId: usuario.id },
        cliente,
      );
      return { token };
    });
  } catch (erro) {
    // Cadastros simultâneos com o mesmo e-mail: o segundo vira "já existe".
    if (erro instanceof ErroDeConflito && erro.codigo === 'email_em_uso') {
      return 'existente';
    }
    throw erro;
  }
}

function credenciaisInvalidas(
  dep: DependenciasDeAuth,
  usuario?: UsuarioComSenha,
): ErroNaoAutenticado {
  registrarAuditoria(dep.registrador, 'login_falha', {
    ...(usuario ? { contaId: usuario.contaId, usuarioId: usuario.id } : {}),
  });
  return new ErroNaoAutenticado('E-mail ou senha incorretos.', 'credenciais_invalidas');
}

async function entrar(dep: DependenciasDeAuth, email: string, senha: string): Promise<Usuario> {
  const usuario = await dep.sistema.buscarUsuarioPorEmail(email);
  const agora = dep.relogio.agora();
  if (usuario === undefined || (usuario.bloqueadoAte !== null && usuario.bloqueadoAte > agora)) {
    await simularVerificacaoDeSenha(senha);
    throw credenciaisInvalidas(dep, usuario);
  }
  if (!(await verificarSenha(usuario.hashSenha, senha))) {
    await dep.usuarios.registrarFalhaDeLogin(usuario.contaId, usuario.id, {
      limite: LIMITE_TENTATIVAS_LOGIN,
      bloqueadoAte: new Date(agora.getTime() + DURACAO_BLOQUEIO_LOGIN_MS),
    });
    throw credenciaisInvalidas(dep, usuario);
  }
  await dep.usuarios.registrarLoginSucesso(usuario.contaId, usuario.id, agora);
  registrarAuditoria(dep.registrador, 'login_sucesso', {
    contaId: usuario.contaId,
    usuarioId: usuario.id,
  });
  return semSenha(usuario);
}

async function confirmarEmail(dep: DependenciasDeAuth, tokenTextual: string): Promise<void> {
  const token = await dep.gestorDeTokens.localizar(tokenTextual, 'email_verification');
  await comTransacao(dep.banco, async (cliente) => {
    await dep.gestorDeTokens.consumir(token, cliente);
    await dep.usuarios.confirmarEmail(
      token.contaId,
      usuarioDoToken(token),
      dep.relogio.agora(),
      cliente,
    );
  });
}

async function reenviarConfirmacao(dep: DependenciasDeAuth, email: string): Promise<void> {
  const usuario = await dep.sistema.buscarUsuarioPorEmail(email);
  if (usuario?.emailConfirmadoEm !== null) {
    return;
  }
  const token = await dep.gestorDeTokens.emitir(usuario.contaId, {
    tipo: 'email_verification',
    email: usuario.email,
    usuarioId: usuario.id,
  });
  dep.gestorDeTokens.enviar({
    para: usuario.email,
    ...montarEmailDeConfirmacao({
      nomeNegocio: dep.configuracao.nomeNegocio,
      nomeUsuario: usuario.nome,
      link: dep.gestorDeTokens.montarLink('/confirmar-email', token),
    }),
  });
}

async function solicitarRedefinicao(dep: DependenciasDeAuth, email: string): Promise<void> {
  const usuario = await dep.sistema.buscarUsuarioPorEmail(email);
  if (usuario === undefined) {
    return;
  }
  const token = await dep.gestorDeTokens.emitir(usuario.contaId, {
    tipo: 'password_reset',
    email: usuario.email,
    usuarioId: usuario.id,
  });
  dep.gestorDeTokens.enviar({
    para: usuario.email,
    ...montarEmailDeRedefinicaoDeSenha({
      nomeNegocio: dep.configuracao.nomeNegocio,
      nomeUsuario: usuario.nome,
      link: dep.gestorDeTokens.montarLink('/redefinir-senha', token),
    }),
  });
}

async function redefinirSenha(
  dep: DependenciasDeAuth,
  tokenTextual: string,
  novaSenha: string,
): Promise<void> {
  const hash = await gerarHashDeSenha(novaSenha);
  const token = await dep.gestorDeTokens.localizar(tokenTextual, 'password_reset');
  const usuarioId = usuarioDoToken(token);
  await comTransacao(dep.banco, async (cliente) => {
    await dep.gestorDeTokens.consumir(token, cliente);
    await dep.usuarios.atualizarSenha(token.contaId, usuarioId, hash, cliente);
  });
  await dep.encerradorDeSessoes.encerrarDoUsuario(usuarioId);
  registrarAuditoria(dep.registrador, 'senha_redefinida', { contaId: token.contaId, usuarioId });
}

async function obterUsuario(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  usuarioId: UsuarioId,
): Promise<Usuario> {
  const usuario = await dep.usuarios.buscarPorId(contaId, usuarioId);
  if (usuario === undefined) {
    throw new ErroNaoEncontrado('Usuário não encontrado.', 'usuario_nao_encontrado');
  }
  return usuario;
}

async function carregarContexto(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  usuarioId: UsuarioId,
): Promise<ContextoAutenticado | undefined> {
  const usuario = await dep.usuarios.buscarPorId(contaId, usuarioId);
  return (
    usuario && {
      usuarioId: usuario.id,
      contaId: usuario.contaId,
      papel: usuario.papel,
      emailConfirmado: usuario.emailConfirmadoEm !== null,
    }
  );
}
