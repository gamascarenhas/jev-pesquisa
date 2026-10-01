import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify, { LogController, type FastifyInstance } from 'fastify';

import { compor, type OpcoesDeComposicao } from './composicao.js';
import type { Configuracao } from './config/config.js';
import { criarBanco, verificarBanco, type Banco } from './db/conexoes.js';
import type { ExecutorTrabalhos } from './jobs/executor-trabalhos.js';
import type { Agendador } from './scheduler/agendador.js';
import { prepararEstaticos, type EstaticosPreparados } from './http/plugins/estaticos.plugin.js';
import { registrarCabecalhosDeSeguranca } from './http/plugins/cabecalhos-seguranca.plugin.js';
import { registrarLimiteDeRequisicoes } from './http/plugins/limite-requisicoes.plugin.js';
import { registrarManipuladorDeErros } from './http/plugins/manipulador-erros.plugin.js';
import { registrarProtecaoCsrf } from './http/plugins/protecao-csrf.plugin.js';
import {
  criarArmazenamentoDeSessao,
  registrarSessao,
  type ArmazenamentoDeSessao,
} from './http/plugins/sessao.plugin.js';
import { registrarRotas, type ServicosDaAplicacao } from './http/registrar-rotas.js';
import { criarRegistrador, type Registrador } from './shared/logger.js';
import { relogioDoSistema, type Relogio } from './shared/clock.js';

export const TEMPO_LIMITE_DESLIGAMENTO_MS = 30_000;
const LIMITE_CORPO_PADRAO_BYTES = 1_048_576;
const INTERVALO_VARREDURA_OCIOSAS_MS = 100;
const DIRETORIO_DO_BUILD_WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export interface OpcoesAplicacao extends OpcoesDeComposicao {
  registrador?: Registrador;
  relogio?: Relogio;
  /** Só em produção o servidor serve o build do web; os testes informam o diretório. */
  diretorioWeb?: string;
}

export interface Aplicacao {
  app: FastifyInstance;
  banco: Banco;
  registrador: Registrador;
  relogio: Relogio;
  configuracao: Readonly<Configuracao>;
  servicos: ServicosDaAplicacao;
  executorDeTrabalhos: ExecutorTrabalhos;
  agendador: Agendador;
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
  const app = criarServidor(configuracao, registrador);
  const armazenamentoDeSessao = criarArmazenamentoDeSessao(banco, relogio);
  const { servicos, executorDeTrabalhos, agendador } = compor({
    banco,
    configuracao,
    registrador,
    relogio,
    armazenamentoDeSessao,
    opcoes,
  });

  const front = await prepararFront(configuracao, opcoes.diretorioWeb);
  await registrarPlugins(app, configuracao, armazenamentoDeSessao, front?.tratarRotaDoFront);
  await registrarRotas(app, {
    nomeNegocio: configuracao.nomeNegocio,
    cobrancaAtivada: configuracao.cobrancaAtivada,
    verificarBanco: () => verificarBanco(banco),
    relogio,
    servicos,
  });
  await front?.registrar(app);

  return {
    app,
    banco,
    registrador,
    relogio,
    configuracao,
    servicos,
    executorDeTrabalhos,
    agendador,
  };
}

async function registrarPlugins(
  app: FastifyInstance,
  configuracao: Readonly<Configuracao>,
  armazenamento: ArmazenamentoDeSessao,
  tratarRotaDoFront: Parameters<typeof registrarManipuladorDeErros>[2],
): Promise<void> {
  registrarManipuladorDeErros(app, configuracao.estaEmProducao, tratarRotaDoFront);
  await registrarCabecalhosDeSeguranca(app, configuracao);
  await registrarSessao(app, {
    armazenamento,
    segredo: configuracao.segredoSessao,
    estaEmProducao: configuracao.estaEmProducao,
  });
  await registrarLimiteDeRequisicoes(app);
  registrarProtecaoCsrf(app, configuracao.origemApp);
}

function criarServidor(
  configuracao: Readonly<Configuracao>,
  registrador: Registrador,
): FastifyInstance {
  return Fastify({
    loggerInstance: registrador,
    logController: new LogController({ requestIdLogLabel: 'idRequisicao' }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    trustProxy: configuracao.confiarProxy,
    bodyLimit: LIMITE_CORPO_PADRAO_BYTES,
  });
}

async function prepararFront(
  configuracao: Readonly<Configuracao>,
  diretorioInformado: string | undefined,
): Promise<EstaticosPreparados | undefined> {
  const diretorio =
    diretorioInformado ?? (configuracao.estaEmProducao ? DIRETORIO_DO_BUILD_WEB : undefined);
  return diretorio === undefined
    ? undefined
    : prepararEstaticos({ diretorio, nomeNegocio: configuracao.nomeNegocio });
}

type AlvoDoDesligamento = Pick<Aplicacao, 'app' | 'banco' | 'registrador'> &
  Partial<Pick<Aplicacao, 'executorDeTrabalhos' | 'agendador'>>;

export function criarDesligamento(
  aplicacao: AlvoDoDesligamento,
  tempoLimiteMs: number = TEMPO_LIMITE_DESLIGAMENTO_MS,
): () => Promise<void> {
  let emAndamento: Promise<void> | undefined;
  return () => {
    emAndamento ??= encerrar(aplicacao, tempoLimiteMs);
    return emAndamento;
  };
}

async function encerrar(
  { app, banco, registrador, executorDeTrabalhos, agendador }: AlvoDoDesligamento,
  tempoLimiteMs: number,
): Promise<void> {
  registrador.info('encerrando o servidor');
  const paradaDoAgendador = agendador?.parar();
  const paradaDoExecutor = executorDeTrabalhos?.parar();
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
  await paradaDoAgendador;
  await paradaDoExecutor;
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
