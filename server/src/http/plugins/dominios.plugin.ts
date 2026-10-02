import type { FastifyInstance } from 'fastify';

import { identificarDominio, type OrigensDosDominios } from '../dominios.js';
import type { SitePublico } from '../publico.rotas.js';

const CAMINHO_DA_SAUDE = '/api/saude';
const CAMINHO_DO_ROBOTS = '/robots.txt';
// O app não é bloqueado no robots.txt: o noindex só vale se o buscador puder ler a página.
const ROBOTS_DO_APP = 'User-agent: *\nDisallow:\n';

export interface OpcoesDeDominios extends OrigensDosDominios {
  site: SitePublico | undefined;
}

/**
 * Dois domínios, um processo. O `Host` decide: o site responde com as páginas públicas, o app segue
 * para o resto do servidor, e qualquer outro `Host` leva 404. Só a verificação de saúde responde por
 * qualquer `Host`, porque os verificadores a chamam pelo IP.
 */
export function registrarDominios(app: FastifyInstance, opcoes: OpcoesDeDominios): void {
  app.addHook('onRequest', async (requisicao, resposta) => {
    const caminho = requisicao.url.split('?')[0];
    if (caminho === CAMINHO_DA_SAUDE) {
      return;
    }
    const dominio = identificarDominio(requisicao.headers.host, opcoes);
    if (dominio === 'app') {
      if (caminho === CAMINHO_DO_ROBOTS && requisicao.method === 'GET') {
        return resposta.type('text/plain; charset=utf-8').send(ROBOTS_DO_APP);
      }
      return;
    }
    if (dominio === 'site' && opcoes.site !== undefined) {
      await opcoes.site.responder(requisicao, resposta);
      return resposta;
    }
    return resposta.status(404).type('text/plain; charset=utf-8').send('Não encontrado.');
  });

  app.addHook('onSend', (requisicao, resposta, _corpo, pronto) => {
    if (identificarDominio(requisicao.headers.host, opcoes) === 'app') {
      void resposta.header('X-Robots-Tag', 'noindex');
    }
    pronto();
  });
}
