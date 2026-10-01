import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const esquemaConfiguracaoPublica = z
  .object({ nomeNegocio: z.string(), cobrancaAtivada: z.boolean() })
  .strict();

export function registrarRotaConfiguracaoPublica(
  app: FastifyInstance,
  config: { nomeNegocio: string; cobrancaAtivada: boolean },
): void {
  app.get('/configuracao-publica', () =>
    esquemaConfiguracaoPublica.parse({
      nomeNegocio: config.nomeNegocio,
      cobrancaAtivada: config.cobrancaAtivada,
    }),
  );
}
