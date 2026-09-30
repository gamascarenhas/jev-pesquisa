import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import { ErroNaoAutenticado } from '../../shared/errors.js';
import { comoContaId, comoUsuarioId, type ContaId, type UsuarioId } from '../../shared/ids.js';
import type { ContextoAutenticado } from '../../modules/auth/autenticacao.tipos.js';

declare module 'fastify' {
  interface FastifyRequest {
    autenticacao?: ContextoAutenticado;
  }
}

export type CarregadorDeContexto = (
  contaId: ContaId,
  usuarioId: UsuarioId,
) => Promise<ContextoAutenticado | undefined>;

export function criarExigirAutenticacao(
  carregarContexto: CarregadorDeContexto,
): preHandlerAsyncHookHandler {
  return async (requisicao) => {
    const { contaId, usuarioId } = requisicao.session;
    if (contaId === undefined || usuarioId === undefined) {
      throw new ErroNaoAutenticado();
    }
    const contexto = await carregarContexto(comoContaId(contaId), comoUsuarioId(usuarioId));
    if (contexto === undefined) {
      await requisicao.session.destroy();
      throw new ErroNaoAutenticado();
    }
    requisicao.autenticacao = contexto;
  };
}

export function obterContexto(requisicao: FastifyRequest): ContextoAutenticado {
  if (requisicao.autenticacao === undefined) {
    throw new ErroNaoAutenticado();
  }
  return requisicao.autenticacao;
}
