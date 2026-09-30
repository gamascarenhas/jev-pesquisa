import { randomUUID } from 'node:crypto';

import Fastify, { LogController, type FastifyInstance } from 'fastify';

import type { Configuracao } from './config/config.js';
import { criarBanco, verificarBanco, type Banco } from './db/conexoes.js';
import { criarEnviadorLog } from './integrations/mail/enviador-log.js';
import { criarEnviadorSmtp, criarTransporteSmtp } from './integrations/mail/enviador-smtp.js';
import type { EnviadorDeEmail } from './integrations/mail/enviador-email.js';
import { criarContasRepositorio } from './modules/accounts/contas.repositorio.js';
import { criarContasServico } from './modules/accounts/contas.servico.js';
import { criarAutenticacaoServico } from './modules/auth/autenticacao.servico.js';
import { criarAutenticacaoSistemaRepositorio } from './modules/auth/autenticacao.sistema.repositorio.js';
import { criarConvitesServico } from './modules/auth/convites.servico.js';
import type { DependenciasDeAuth } from './modules/auth/dependencias.js';
import { criarGestorDeTokens } from './modules/auth/gestor-tokens.js';
import { criarPerfilServico } from './modules/auth/perfil.servico.js';
import { criarTokensAutenticacaoRepositorio } from './modules/auth/tokens-autenticacao.repositorio.js';
import { criarUsuariosRepositorio } from './modules/auth/usuarios.repositorio.js';
import { criarUsuariosServico } from './modules/auth/usuarios.servico.js';
import {
  criarExclusaoDadosServico,
  type PassoAntesDeEncerrarConta,
} from './modules/data-deletion/exclusao-dados.servico.js';
import { criarPlanosServico } from './modules/plans/planos.servico.js';
import { criarPlanosSistemaRepositorio } from './modules/plans/planos.sistema.repositorio.js';
import { criarProjetosRepositorio } from './modules/projects/projetos.repositorio.js';
import { criarProjetosServico } from './modules/projects/projetos.servico.js';
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

export interface OpcoesAplicacao {
  registrador?: Registrador;
  relogio?: Relogio;
  enviadorDeEmail?: EnviadorDeEmail;
  passosAntesDeEncerrarConta?: PassoAntesDeEncerrarConta[];
}

export interface Aplicacao {
  app: FastifyInstance;
  banco: Banco;
  registrador: Registrador;
  relogio: Relogio;
  configuracao: Readonly<Configuracao>;
  servicos: ServicosDaAplicacao;
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

  const armazenamentoDeSessao = criarArmazenamentoDeSessao(banco, relogio);
  const servicos = montarServicos({
    banco,
    configuracao,
    registrador,
    relogio,
    armazenamentoDeSessao,
    enviador: opcoes.enviadorDeEmail ?? criarEnviador(configuracao, registrador),
    passosAntesDeEncerrarConta: opcoes.passosAntesDeEncerrarConta ?? [],
  });

  registrarManipuladorDeErros(app, configuracao.estaEmProducao);
  await registrarCabecalhosDeSeguranca(app, configuracao);
  await registrarSessao(app, {
    armazenamento: armazenamentoDeSessao,
    segredo: configuracao.segredoSessao,
    estaEmProducao: configuracao.estaEmProducao,
  });
  await registrarLimiteDeRequisicoes(app);
  registrarProtecaoCsrf(app, configuracao.origemApp);
  await registrarRotas(app, {
    nomeNegocio: configuracao.nomeNegocio,
    verificarBanco: () => verificarBanco(banco),
    relogio,
    servicos,
  });

  return { app, banco, registrador, relogio, configuracao, servicos };
}

function criarEnviador(
  configuracao: Readonly<Configuracao>,
  registrador: Registrador,
): EnviadorDeEmail {
  const { email, nomeNegocio } = configuracao;
  if (email.provedor === 'log') {
    return criarEnviadorLog(registrador);
  }
  // O esquema garante os cinco campos quando PROVEDOR_EMAIL=smtp.
  const transporte = criarTransporteSmtp({
    servidor: email.servidor ?? '',
    porta: email.porta ?? 0,
    usuario: email.usuario ?? '',
    senha: email.senha ?? '',
  });
  return criarEnviadorSmtp(transporte, { nome: nomeNegocio, endereco: email.remetente ?? '' });
}

interface EntradaDosServicos {
  banco: Banco;
  configuracao: Readonly<Configuracao>;
  registrador: Registrador;
  relogio: Relogio;
  armazenamentoDeSessao: ArmazenamentoDeSessao;
  enviador: EnviadorDeEmail;
  passosAntesDeEncerrarConta: PassoAntesDeEncerrarConta[];
}

function montarServicos(entrada: EntradaDosServicos): ServicosDaAplicacao {
  const { banco, configuracao, registrador, relogio } = entrada;
  const usuarios = criarUsuariosRepositorio(banco);
  const tokens = criarTokensAutenticacaoRepositorio(banco);
  const sistema = criarAutenticacaoSistemaRepositorio(banco);
  const dependenciasDeAuth: DependenciasDeAuth = {
    banco,
    usuarios,
    tokens,
    sistema,
    gestorDeTokens: criarGestorDeTokens({
      tokens,
      sistema,
      enviador: entrada.enviador,
      relogio,
      registrador,
      urlApp: configuracao.origemApp,
      nomeNegocio: configuracao.nomeNegocio,
    }),
    encerradorDeSessoes: entrada.armazenamentoDeSessao,
    relogio,
    registrador,
    configuracao: {
      nomeNegocio: configuracao.nomeNegocio,
      urlApp: configuracao.origemApp,
      versaoTermos: configuracao.versaoTermos,
      planoPadraoId: configuracao.planoPadraoId,
    },
  };
  const contas = criarContasServico(criarContasRepositorio(banco));
  const usuariosServico = criarUsuariosServico(dependenciasDeAuth);
  const projetos = criarProjetosServico(criarProjetosRepositorio(banco));
  return {
    autenticacao: criarAutenticacaoServico(dependenciasDeAuth),
    convites: criarConvitesServico(dependenciasDeAuth, contas),
    perfil: criarPerfilServico(dependenciasDeAuth),
    usuarios: usuariosServico,
    contas,
    planos: criarPlanosServico(criarPlanosSistemaRepositorio(banco)),
    projetos,
    exclusao: criarExclusaoDadosServico({
      projetos,
      contas,
      usuarios: usuariosServico,
      encerradorDeSessoes: entrada.armazenamentoDeSessao,
      registrador,
      passosAntesDeEncerrarConta: entrada.passosAntesDeEncerrarConta,
    }),
  };
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
