import type { Executor } from '../../db/conexoes.js';
import { montarEmailDeContaJaExistente } from '../../integrations/mail/templates/conta-ja-existente.js';
import type { EnviadorDeEmail, MensagemDeEmail } from '../../integrations/mail/enviador-email.js';
import type { Relogio } from '../../shared/clock.js';
import { ErroDeValidacao } from '../../shared/errors.js';
import type { ContaId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { AutenticacaoSistemaRepositorio } from './autenticacao.sistema.repositorio.js';
import type { Papel, TipoDeToken, TokenAutenticacao } from './autenticacao.tipos.js';
import type { TokensAutenticacaoRepositorio } from './tokens-autenticacao.repositorio.js';
import { calcularHashDeToken, gerarToken } from './tokens.js';

const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;

export const VALIDADE_TOKEN_MS: Record<TipoDeToken, number> = {
  email_verification: UM_DIA_MS,
  password_reset: UMA_HORA_MS,
  invitation: 7 * UM_DIA_MS,
  email_change: UM_DIA_MS,
};

export interface DadosDeEmissao {
  tipo: TipoDeToken;
  email: string;
  usuarioId?: UsuarioId;
  papelConvidado?: Papel;
  criadoPor?: UsuarioId;
}

export interface GestorDeTokens {
  emitir(contaId: ContaId, dados: DadosDeEmissao, executor?: Executor): Promise<string>;
  localizar(tokenTextual: string, tipo: TipoDeToken): Promise<TokenAutenticacao>;
  consumir(token: TokenAutenticacao, executor: Executor): Promise<void>;
  montarLink(caminho: string, token: string): string;
  enviar(mensagem: MensagemDeEmail): void;
  avisarContaExistente(para: string): void;
}

export interface DependenciasDoGestor {
  tokens: TokensAutenticacaoRepositorio;
  sistema: AutenticacaoSistemaRepositorio;
  enviador: EnviadorDeEmail;
  relogio: Relogio;
  registrador: Registrador;
  urlApp: string;
  nomeNegocio: string;
}

function linkInvalido(): ErroDeValidacao {
  return new ErroDeValidacao('Link inválido, expirado ou já usado.', 'link_invalido');
}

export function criarGestorDeTokens(dependencias: DependenciasDoGestor): GestorDeTokens {
  const { tokens, sistema, enviador, relogio, registrador, urlApp, nomeNegocio } = dependencias;
  const enviar = (mensagem: MensagemDeEmail): void => {
    enviador.enviar(mensagem).catch((erro: unknown) => {
      registrador.error({ err: erro }, 'falha ao enviar e-mail');
    });
  };
  return {
    emitir: (contaId, dados, executor) => emitirToken(dependencias, contaId, dados, executor),

    async localizar(tokenTextual, tipo) {
      const token = await sistema.buscarTokenPorHash(calcularHashDeToken(tokenTextual));
      const valido =
        token?.tipo === tipo && token.usadoEm === null && token.expiraEm > relogio.agora();
      if (!valido) {
        throw linkInvalido();
      }
      return token;
    },

    async consumir(token, executor) {
      if (!(await tokens.consumir(token.contaId, token.id, relogio.agora(), executor))) {
        throw linkInvalido();
      }
    },

    montarLink: (caminho, token) => `${urlApp}${caminho}?token=${token}`,

    // Em segundo plano: a resposta demora igual com ou sem e-mail existente.
    enviar,

    avisarContaExistente(para) {
      enviar({
        para,
        ...montarEmailDeContaJaExistente({
          nomeNegocio,
          linkEntrar: `${urlApp}/entrar`,
          linkRedefinirSenha: `${urlApp}/esqueci-senha`,
        }),
      });
    },
  };
}

async function emitirToken(
  { tokens, relogio }: DependenciasDoGestor,
  contaId: ContaId,
  dados: DadosDeEmissao,
  executor?: Executor,
): Promise<string> {
  const { token, hashToken } = gerarToken();
  if (dados.usuarioId === undefined) {
    await tokens.apagarConvitesPendentesDoEmail(contaId, dados.email, executor);
  } else {
    await tokens.apagarPendentesDoUsuario(contaId, dados.usuarioId, dados.tipo, executor);
  }
  await tokens.criar(
    contaId,
    {
      usuarioId: dados.usuarioId ?? null,
      tipo: dados.tipo,
      email: dados.email,
      hashToken,
      papelConvidado: dados.papelConvidado ?? null,
      criadoPor: dados.criadoPor ?? null,
      expiraEm: new Date(relogio.agora().getTime() + VALIDADE_TOKEN_MS[dados.tipo]),
    },
    executor,
  );
  return token;
}
