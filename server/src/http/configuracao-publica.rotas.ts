import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const esquemaConfiguracaoPublica = z.object({ nomeNegocio: z.string() }).strict();

export function registrarRotaConfiguracaoPublica(
  app: FastifyInstance,
  config: { nomeNegocio: string },
): void {
  app.get('/configuracao-publica', () =>
    esquemaConfiguracaoPublica.parse({ nomeNegocio: config.nomeNegocio }),
  );
}
