import type { preHandlerAsyncHookHandler } from 'fastify';

import { ErroProibido } from '../../shared/errors.js';
import { obterContexto } from './exigir-autenticacao.js';

export const exigirDono: preHandlerAsyncHookHandler = (requisicao) => {
  if (obterContexto(requisicao).papel !== 'owner') {
    return Promise.reject(new ErroProibido('Só o dono da conta pode fazer isso.', 'apenas_owner'));
  }
  return Promise.resolve();
};
