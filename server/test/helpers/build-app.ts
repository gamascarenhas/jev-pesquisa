import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { criarAplicacao, type Aplicacao } from '../../src/app.js';
import { carregarConfiguracao, type Configuracao } from '../../src/config/config.js';
import { semearPlanos } from '../../src/db/dados-iniciais.js';
import { aplicarMigracoes } from '../../src/db/migrar.js';
import type { ClassificadorDeComentarios } from '../../src/integrations/jev/classificador-comentarios.js';
import type { OpcoesDoExecutor } from '../../src/jobs/executor-trabalhos.js';
import type { GanchoDeRecuperacao, MapaDeManipuladores } from '../../src/jobs/trabalhos.tipos.js';
import type { EnviadorDeEmail } from '../../src/integrations/mail/enviador-email.js';
import type { PassoAntesDeEncerrarConta } from '../../src/modules/data-deletion/exclusao-dados.servico.js';
import { criarRegistrador, type Registrador } from '../../src/shared/logger.js';
import type { Relogio } from '../../src/shared/clock.js';

export interface OpcoesAppDeTeste {
  configuracao?: Partial<Configuracao>;
  registrador?: Registrador;
  relogio?: Relogio;
  enviadorDeEmail?: EnviadorDeEmail;
  passosAntesDeEncerrarConta?: PassoAntesDeEncerrarConta[];
  manipuladoresDeTrabalho?: MapaDeManipuladores;
  ganchosDeRecuperacao?: GanchoDeRecuperacao[];
  diretorioDeEnvios?: string;
  classificadorDeComentarios?: ClassificadorDeComentarios;
  ajustesDoExecutor?: Partial<OpcoesDoExecutor>;
  /** Padrão true; false testa o app sem banco. */
  prepararBanco?: boolean;
  diretorioWeb?: string;
  rotasExtras?: (app: FastifyInstance, aplicacao: Aplicacao) => void;
}

export interface AppDeTeste extends Aplicacao {
  diretorioDeEnvios: string;
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
  const diretorioDeEnvios =
    opcoes.diretorioDeEnvios ?? (await mkdtemp(join(tmpdir(), 'envios-teste-')));
  const aplicacao = await criarAplicacao(configuracao, {
    ...opcoes,
    diretorioDeEnvios,
    registrador: opcoes.registrador ?? criarRegistrador({ nivel: 'silent', legivel: false }),
  });
  if (opcoes.prepararBanco !== false) {
    await aplicarMigracoes(aplicacao.banco, aplicacao.registrador);
    await semearPlanos(aplicacao.banco);
  }
  opcoes.rotasExtras?.(aplicacao.app, aplicacao);
  await aplicacao.app.ready();

  let encerrado = false;
  const encerrar = async (): Promise<void> => {
    if (encerrado) {
      return;
    }
    encerrado = true;
    await aplicacao.executorDeTrabalhos.parar();
    await aplicacao.app.close();
    await aplicacao.banco.end();
    await rm(diretorioDeEnvios, { recursive: true, force: true });
  };
  return { ...aplicacao, diretorioDeEnvios, encerrar };
}
