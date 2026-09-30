import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ErroProibido } from '../../shared/errors.js';

const METODOS_QUE_MUDAM_ESTADO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function origemDaRequisicao(requisicao: FastifyRequest): string | undefined {
  const origem = requisicao.headers.origin;
  if (origem !== undefined) {
    return origem;
  }
  const referer = requisicao.headers.referer;
  if (referer === undefined) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** Em POST, PUT, PATCH e DELETE exige Origin (ou Referer) igual a URL_APP; senão 403. */
export function registrarProtecaoCsrf(app: FastifyInstance, origemApp: string): void {
  app.addHook('onRequest', (requisicao, _resposta, pronto) => {
    if (!METODOS_QUE_MUDAM_ESTADO.has(requisicao.method)) {
      pronto();
      return;
    }
    if (origemDaRequisicao(requisicao) !== origemApp) {
      pronto(new ErroProibido('Origem da requisição não permitida.', 'origem_invalida'));
      return;
    }
    pronto();
  });
}
