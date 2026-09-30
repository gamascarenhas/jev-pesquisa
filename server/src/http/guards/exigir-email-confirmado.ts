import type { preHandlerAsyncHookHandler } from 'fastify';

import { ErroProibido } from '../../shared/errors.js';
import { obterContexto } from './exigir-autenticacao.js';

export const exigirEmailConfirmado: preHandlerAsyncHookHandler = (requisicao) => {
  if (!obterContexto(requisicao).emailConfirmado) {
    return Promise.reject(
      new ErroProibido('Confirme seu e-mail para usar este recurso.', 'email_nao_confirmado'),
    );
  }
  return Promise.resolve();
};
