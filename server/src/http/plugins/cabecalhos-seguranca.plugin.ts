import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

import type { Configuracao } from '../../config/config.js';

const HSTS_DURACAO_SEGUNDOS = 15_552_000;
const POLITICA_DE_PERMISSOES = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

type OpcoesCabecalhos = Pick<
  Configuracao,
  'estaEmProducao' | 'origensEstiloExterno' | 'origensFonteExterna'
>;

/** A CSP só libera fontes e estilos das origens configuradas. */
export async function registrarCabecalhosDeSeguranca(
  app: FastifyInstance,
  config: OpcoesCabecalhos,
): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", ...config.origensEstiloExterno],
        fontSrc: ["'self'", ...config.origensFonteExterna],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: config.estaEmProducao
      ? { maxAge: HSTS_DURACAO_SEGUNDOS, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // O helmet não cobre Permissions-Policy.
  app.addHook('onSend', (_requisicao, resposta, _corpo, pronto) => {
    resposta.header('Permissions-Policy', POLITICA_DE_PERMISSOES);
    pronto();
  });
}
