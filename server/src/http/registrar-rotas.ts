import type { FastifyInstance } from 'fastify';

import { registrarRotaConfiguracaoPublica } from './configuracao-publica.rotas.js';
import { registrarRotaSaude, type DependenciasSaude } from './saude.rotas.js';

export interface DependenciasRotas extends DependenciasSaude {
  nomeNegocio: string;
}

export async function registrarRotas(
  app: FastifyInstance,
  dependencias: DependenciasRotas,
): Promise<void> {
  await app.register(
    (api, _opcoes, pronto) => {
      registrarRotaConfiguracaoPublica(api, { nomeNegocio: dependencias.nomeNegocio });
      registrarRotaSaude(api, { verificarBanco: dependencias.verificarBanco });
      pronto();
    },
    { prefix: '/api' },
  );
}
