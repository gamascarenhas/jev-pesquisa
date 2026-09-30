import { comTransacao } from '../../db/transacao.js';
import { montarEmailDeConvite } from '../../integrations/mail/templates/convite.js';
import { registrarAuditoria } from '../../shared/auditoria.js';
import { ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId, TokenId, UsuarioId } from '../../shared/ids.js';
import type { ContasServico } from '../accounts/contas.servico.js';
import type { Papel, TokenAutenticacao } from './autenticacao.tipos.js';
import type { DependenciasDeAuth } from './dependencias.js';
import { gerarHashDeSenha } from './senha.js';

export interface ConvitesServico {
  convidar(
    contaId: ContaId,
    convidanteId: UsuarioId,
    entrada: { email: string; papel: Papel },
  ): Promise<void>;
  listarPendentes(contaId: ContaId): Promise<TokenAutenticacao[]>;
  revogar(contaId: ContaId, executorId: UsuarioId, conviteId: TokenId): Promise<void>;
  aceitar(token: string, entrada: { nome: string; senha: string }): Promise<void>;
}

export function criarConvitesServico(
  dep: DependenciasDeAuth,
  contas: ContasServico,
): ConvitesServico {
  return {
    convidar: (contaId, convidanteId, entrada) =>
      convidar(dep, contas, contaId, convidanteId, entrada),
    listarPendentes: (contaId) => dep.tokens.listarConvitesPendentes(contaId, dep.relogio.agora()),
    revogar: (contaId, executorId, conviteId) => revogar(dep, contaId, executorId, conviteId),
    aceitar: (token, entrada) => aceitar(dep, token, entrada),
  };
}

async function convidar(
  dep: DependenciasDeAuth,
  contas: ContasServico,
  contaId: ContaId,
  convidanteId: UsuarioId,
  entrada: { email: string; papel: Papel },
): Promise<void> {
  const { nomeNegocio } = dep.configuracao;
  registrarAuditoria(dep.registrador, 'convite_criado', { contaId, usuarioId: convidanteId });
  if (await dep.sistema.existeUsuarioComEmail(entrada.email)) {
    dep.gestorDeTokens.avisarContaExistente(entrada.email);
    return;
  }
  const [conta, convidante] = await Promise.all([
    contas.obter(contaId),
    dep.usuarios.buscarPorId(contaId, convidanteId),
  ]);
  const token = await dep.gestorDeTokens.emitir(contaId, {
    tipo: 'invitation',
    email: entrada.email,
    papelConvidado: entrada.papel,
    criadoPor: convidanteId,
  });
  dep.gestorDeTokens.enviar({
    para: entrada.email,
    ...montarEmailDeConvite({
      nomeNegocio,
      nomeConvidante: convidante?.nome ?? conta.nome,
      nomeEmpresa: conta.nome,
      link: dep.gestorDeTokens.montarLink('/aceitar-convite', token),
    }),
  });
}

async function revogar(
  dep: DependenciasDeAuth,
  contaId: ContaId,
  executorId: UsuarioId,
  conviteId: TokenId,
): Promise<void> {
  if (!(await dep.tokens.apagarConvitePendente(contaId, conviteId))) {
    throw new ErroNaoEncontrado('Convite não encontrado.', 'convite_nao_encontrado');
  }
  registrarAuditoria(dep.registrador, 'convite_revogado', {
    contaId,
    usuarioId: executorId,
    alvoId: conviteId,
  });
}

async function aceitar(
  dep: DependenciasDeAuth,
  tokenTextual: string,
  entrada: { nome: string; senha: string },
): Promise<void> {
  const hashSenha = await gerarHashDeSenha(entrada.senha);
  const token = await dep.gestorDeTokens.localizar(tokenTextual, 'invitation');
  const agora = dep.relogio.agora();
  await comTransacao(dep.banco, async (cliente) => {
    await dep.gestorDeTokens.consumir(token, cliente);
    await dep.usuarios.criar(
      token.contaId,
      {
        nome: entrada.nome,
        email: token.email,
        hashSenha,
        papel: token.papelConvidado ?? 'member',
        emailConfirmadoEm: agora,
        termosAceitosEm: agora,
        versaoTermos: dep.configuracao.versaoTermos,
      },
      cliente,
    );
  });
}
