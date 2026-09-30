import { randomUUID } from 'node:crypto';

import Fastify, { LogController, type FastifyInstance } from 'fastify';

import type { Configuracao } from './config/config.js';
import { criarBanco, verificarBanco, type Banco } from './db/conexoes.js';
import { registrarCabecalhosDeSeguranca } from './http/plugins/cabecalhos-seguranca.plugin.js';
import { registrarLimiteDeRequisicoes } from './http/plugins/limite-requisicoes.plugin.js';
import { registrarManipuladorDeErros } from './http/plugins/manipulador-erros.plugin.js';
import { registrarProtecaoCsrf } from './http/plugins/protecao-csrf.plugin.js';
import { registrarRotas } from './http/registrar-rotas.js';
import { criarRegistrador, type Registrador } from './shared/logger.js';
import { relogioDoSistema, type Relogio } from './shared/clock.js';

export const TEMPO_LIMITE_DESLIGAMENTO_MS = 30_000;
const LIMITE_CORPO_PADRAO_BYTES = 1_048_576;
const INTERVALO_VARREDURA_OCIOSAS_MS = 100;

export interface OpcoesAplicacao {
  registrador?: Registrador;
  relogio?: Relogio;
}

export interface Aplicacao {
  app: FastifyInstance;
  banco: Banco;
  registrador: Registrador;
  relogio: Relogio;
  configuracao: Readonly<Configuracao>;
}

type SinalDeEncerramento = 'SIGTERM' | 'SIGINT';

export interface AlvoDeSinais {
  once(sinal: SinalDeEncerramento, ouvinte: () => void): unknown;
}

export async function criarAplicacao(
  configuracao: Readonly<Configuracao>,
  opcoes: OpcoesAplicacao = {},
): Promise<Aplicacao> {
  const registrador =
    opcoes.registrador ??
    criarRegistrador({
      nivel: configuracao.estaEmProducao ? 'info' : 'debug',
      legivel: !configuracao.estaEmProducao,
    });
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const banco = criarBanco(configuracao.urlBanco);

  const app = Fastify({
    loggerInstance: registrador,
    logController: new LogController({ requestIdLogLabel: 'idRequisicao' }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    trustProxy: configuracao.confiarProxy,
    bodyLimit: LIMITE_CORPO_PADRAO_BYTES,
  });

  registrarManipuladorDeErros(app, configuracao.estaEmProducao);
  await registrarCabecalhosDeSeguranca(app, configuracao);
  await registrarLimiteDeRequisicoes(app);
  registrarProtecaoCsrf(app, configuracao.origemApp);
  await registrarRotas(app, {
    nomeNegocio: configuracao.nomeNegocio,
    verificarBanco: () => verificarBanco(banco),
  });

  return { app, banco, registrador, relogio, configuracao };
}

export function criarDesligamento(
  aplicacao: Pick<Aplicacao, 'app' | 'banco' | 'registrador'>,
  tempoLimiteMs: number = TEMPO_LIMITE_DESLIGAMENTO_MS,
): () => Promise<void> {
  let emAndamento: Promise<void> | undefined;
  return () => {
    emAndamento ??= encerrar(aplicacao, tempoLimiteMs);
    return emAndamento;
  };
}

async function encerrar(
  { app, banco, registrador }: Pick<Aplicacao, 'app' | 'banco' | 'registrador'>,
  tempoLimiteMs: number,
): Promise<void> {
  registrador.info('encerrando o servidor');
  let temporizador: NodeJS.Timeout | undefined;
  const estouro = new Promise<'tempo_esgotado'>((resolver) => {
    temporizador = setTimeout(() => {
      resolver('tempo_esgotado');
    }, tempoLimiteMs);
  });
  // Fecha conexões keep-alive ociosas; o close() sozinho espera o timeout delas.
  const varredura = setInterval(() => {
    app.server.closeIdleConnections();
  }, INTERVALO_VARREDURA_OCIOSAS_MS);
  const resultado = await Promise.race([app.close().then(() => 'fechado' as const), estouro]);
  clearInterval(varredura);
  clearTimeout(temporizador);
  if (resultado === 'tempo_esgotado') {
    registrador.warn('requisições em andamento não terminaram a tempo; encerrando mesmo assim');
  }
  await banco.end();
  registrador.info('servidor encerrado');
}

export function registrarSinaisDeEncerramento(
  desligar: () => Promise<void>,
  alvo: AlvoDeSinais,
  aoTerminar: (codigoDeSaida: number) => void,
): void {
  const sinais: SinalDeEncerramento[] = ['SIGTERM', 'SIGINT'];
  for (const sinal of sinais) {
    alvo.once(sinal, () => {
      desligar().then(
        () => {
          aoTerminar(0);
        },
        () => {
          aoTerminar(1);
        },
      );
    });
  }
}
