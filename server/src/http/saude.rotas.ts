import type { FastifyInstance } from 'fastify';

import { ErroServicoIndisponivel } from '../shared/errors.js';

export interface DependenciasSaude {
  verificarBanco: () => Promise<void>;
}

export function registrarRotaSaude(app: FastifyInstance, dependencias: DependenciasSaude): void {
  app.get('/saude', async (requisicao) => {
    try {
      await dependencias.verificarBanco();
    } catch (erro) {
      requisicao.log.error({ err: erro }, 'banco indisponível na verificação de saúde');
      throw new ErroServicoIndisponivel('Serviço indisponível.', 'banco_indisponivel');
    }
    return { status: 'ok' };
  });
}
