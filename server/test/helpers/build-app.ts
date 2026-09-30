import type { FastifyInstance } from 'fastify';

import { criarAplicacao, type Aplicacao } from '../../src/app.js';
import { carregarConfiguracao, type Configuracao } from '../../src/config/config.js';
import { semearPlanos } from '../../src/db/dados-iniciais.js';
import { aplicarMigracoes } from '../../src/db/migrar.js';
import { criarRegistrador, type Registrador } from '../../src/shared/logger.js';
import type { Relogio } from '../../src/shared/clock.js';

export interface OpcoesAppDeTeste {
  configuracao?: Partial<Configuracao>;
  registrador?: Registrador;
  relogio?: Relogio;
  /** Padrão true; false testa o app sem banco. */
  prepararBanco?: boolean;
  rotasExtras?: (app: FastifyInstance) => void;
}

export interface AppDeTeste extends Aplicacao {
  encerrar: () => Promise<void>;
}

export function carregarConfiguracaoDeTeste(
  sobrescritas: Partial<Configuracao> = {},
): Configuracao {
  const base = carregarConfiguracao();
  if (base.urlBancoTestes === undefined) {
    throw new Error('URL_BANCO_TESTES não está definida; os testes não rodam sem ela.');
  }
  if (base.urlBancoTestes === base.urlBanco) {
    throw new Error('URL_BANCO_TESTES não pode ser igual a URL_BANCO.');
  }
  return { ...base, urlBanco: base.urlBancoTestes, ...sobrescritas };
}

export async function montarAppDeTeste(opcoes: OpcoesAppDeTeste = {}): Promise<AppDeTeste> {
  const configuracao = carregarConfiguracaoDeTeste(opcoes.configuracao);
  const aplicacao = await criarAplicacao(configuracao, {
    registrador: opcoes.registrador ?? criarRegistrador({ nivel: 'silent', legivel: false }),
    ...(opcoes.relogio ? { relogio: opcoes.relogio } : {}),
  });
  if (opcoes.prepararBanco !== false) {
    await aplicarMigracoes(aplicacao.banco, aplicacao.registrador);
    await semearPlanos(aplicacao.banco);
  }
  opcoes.rotasExtras?.(aplicacao.app);
  await aplicacao.app.ready();

  let encerrado = false;
  const encerrar = async (): Promise<void> => {
    if (encerrado) {
      return;
    }
    encerrado = true;
    await aplicacao.app.close();
    await aplicacao.banco.end();
  };
  return { ...aplicacao, encerrar };
}
