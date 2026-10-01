import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Configuracao } from './config/config.js';
import { montarDependenciasDeAuth } from './composicao-auth.js';
import { criarClassificador, criarEnviador } from './composicao-externos.js';
import type { Banco } from './db/conexoes.js';
import type { ArmazenamentoDeSessao } from './http/plugins/sessao.plugin.js';
import type { ServicosDaAplicacao } from './http/registrar-rotas.js';
import type { EnviadorDeEmail } from './integrations/mail/enviador-email.js';
import {
  criarExecutorTrabalhos,
  type ExecutorTrabalhos,
  type OpcoesDoExecutor,
} from './jobs/executor-trabalhos.js';
import { criarFilaTrabalhos, type FilaTrabalhos } from './jobs/fila-trabalhos.js';
import { criarManipuladorClassificar } from './jobs/handlers/classificar.manipulador.js';
import { criarManipuladorImportarEnvio } from './jobs/handlers/importar-envio.manipulador.js';
import { criarRecuperacaoTrabalhos } from './jobs/recuperacao-trabalhos.js';
import { criarTrabalhosRepositorio } from './jobs/trabalhos.repositorio.js';
import { criarTrabalhosServico } from './jobs/trabalhos.servico.js';
import type { GanchoDeRecuperacao, MapaDeManipuladores } from './jobs/trabalhos.tipos.js';
import type { FonteDeAvaliacoes } from './integrations/google/fonte-avaliacoes.js';
import { montarGoogle, sincronizarGoogleAgendado, type Google } from './composicao-google.js';
import type { ClassificadorDeComentarios } from './integrations/jev/classificador-comentarios.js';
import { criarClassificacoesRepositorio } from './modules/classification/classificacoes.repositorio.js';
import {
  criarClassificacaoServico,
  type ClassificacaoServico,
} from './modules/classification/classificacao.servico.js';
import { criarContasRepositorio } from './modules/accounts/contas.repositorio.js';
import { criarContasServico } from './modules/accounts/contas.servico.js';
import { criarAutenticacaoServico } from './modules/auth/autenticacao.servico.js';
import { criarConvitesServico } from './modules/auth/convites.servico.js';
import { criarPerfilServico } from './modules/auth/perfil.servico.js';
import { criarUsuariosServico } from './modules/auth/usuarios.servico.js';
import { criarComentariosRepositorio } from './modules/comments/comentarios.repositorio.js';
import { criarConsultasComentariosRepositorio } from './modules/comments/consultas-comentarios.repositorio.js';
import {
  criarComentariosServico,
  criarImportadorDeComentarios,
  type ComentariosServico,
} from './modules/comments/comentarios.servico.js';
import { criarExportacaoServico } from './modules/dashboard/exportacao.servico.js';
import { criarPainelServico } from './modules/dashboard/painel.servico.js';
import { criarRevisoesRepositorio } from './modules/classification/revisoes.repositorio.js';
import {
  criarExclusaoDadosServico,
  type PassoAntesDeEncerrarConta,
} from './modules/data-deletion/exclusao-dados.servico.js';
import { criarPlanosServico } from './modules/plans/planos.servico.js';
import { criarPlanosSistemaRepositorio } from './modules/plans/planos.sistema.repositorio.js';
import { criarProjetosRepositorio } from './modules/projects/projetos.repositorio.js';
import { criarProjetosServico } from './modules/projects/projetos.servico.js';
import { criarArmazenamentoDeEnvios } from './modules/uploads/armazenamento-envios.js';
import { criarEnviosServico } from './modules/uploads/envios.servico.js';
import { criarFontesRepositorio } from './modules/uploads/fontes.repositorio.js';
import { criarImportacaoDeEnvios } from './modules/uploads/importacao-envios.js';
import { criarLimpezaDeEnvios } from './modules/uploads/limpeza-envios.js';
import { criarControleDeCustoDoSistema } from './modules/usage/controle-custo-sistema.js';
import type { ControleDeCusto } from './modules/usage/controle-custo.servico.js';
import { escolherProvedorDeCobranca } from './modules/billing/provedor-cobranca.js';
import type { ProvedorDeCobranca } from './modules/billing/provedor-cobranca.js';
import { montarAgendadorDoSistema } from './composicao-agendador.js';
import type { Agendador } from './scheduler/agendador.js';
import type { Relogio } from './shared/clock.js';
import type { Registrador } from './shared/logger.js';

export const DIRETORIO_PADRAO_DE_ENVIOS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../tmp/uploads',
);

export interface OpcoesDeComposicao {
  enviadorDeEmail?: EnviadorDeEmail;
  passosAntesDeEncerrarConta?: PassoAntesDeEncerrarConta[];
  manipuladoresDeTrabalho?: MapaDeManipuladores;
  ganchosDeRecuperacao?: GanchoDeRecuperacao[];
  diretorioDeEnvios?: string;
  classificadorDeComentarios?: ClassificadorDeComentarios;
  fonteDeAvaliacoes?: FonteDeAvaliacoes;
  ajustesDoExecutor?: Partial<OpcoesDoExecutor>;
}

export interface EntradaBase {
  banco: Banco;
  configuracao: Readonly<Configuracao>;
  registrador: Registrador;
  relogio: Relogio;
  armazenamentoDeSessao: ArmazenamentoDeSessao;
  opcoes: OpcoesDeComposicao;
}

export interface EntradaDaComposicao extends EntradaBase {
  enviador: EnviadorDeEmail;
}

export interface Composicao {
  servicos: ServicosDaAplicacao;
  executorDeTrabalhos: ExecutorTrabalhos;
  agendador: Agendador;
  provedorDeCobranca: ProvedorDeCobranca;
}

interface Uploads {
  envios: ServicosDaAplicacao['envios'];
  armazenamento: ReturnType<typeof criarArmazenamentoDeEnvios>;
  importacao: ReturnType<typeof criarImportacaoDeEnvios>;
  limpeza: () => Promise<void>;
}

function montarUploads(
  entrada: EntradaDaComposicao,
  projetos: ServicosDaAplicacao['projetos'],
  trabalhos: ServicosDaAplicacao['trabalhos'],
): Uploads {
  const { banco, registrador, relogio, opcoes } = entrada;
  const armazenamento = criarArmazenamentoDeEnvios(
    opcoes.diretorioDeEnvios ?? DIRETORIO_PADRAO_DE_ENVIOS,
  );
  const fontes = criarFontesRepositorio(banco);
  const comentarios = criarImportadorDeComentarios(criarComentariosRepositorio(banco));
  return {
    envios: criarEnviosServico({ armazenamento, projetos, fontes, trabalhos }),
    armazenamento,
    importacao: criarImportacaoDeEnvios({ banco, armazenamento, fontes, comentarios }),
    limpeza: criarLimpezaDeEnvios({ armazenamento, trabalhos, relogio, registrador }),
  };
}

interface Nucleo {
  fila: FilaTrabalhos;
  uploads: Uploads;
  custo: ControleDeCusto;
  classificacao: ClassificacaoServico;
  comentarios: ComentariosServico;
}

function montarNucleo(
  entrada: EntradaDaComposicao,
  projetos: ServicosDaAplicacao['projetos'],
  trabalhos: ServicosDaAplicacao['trabalhos'],
  usuarios: ServicosDaAplicacao['usuarios'],
): Nucleo {
  const { banco, registrador, relogio, configuracao } = entrada;
  const fila = criarFilaTrabalhos(banco);
  const custo = criarControleDeCustoDoSistema({
    enviador: entrada.enviador,
    listarDonos: async (contaId) =>
      (await usuarios.listar(contaId)).filter((usuario) => usuario.papel === 'owner'),
    banco,
    configuracao,
    registrador,
    relogio,
    retomarJob: (trabalhoId, agora) => fila.retomarPausado(trabalhoId, agora),
  });
  const classificacao = criarClassificacaoServico({
    classificacoes: criarClassificacoesRepositorio(banco),
    revisoes: criarRevisoesRepositorio(banco),
    projetos,
    trabalhos,
    controleDeCusto: custo,
    classificador: criarClassificador(entrada),
    registrador,
    concorrencia: configuracao.jev.concorrencia,
  });
  const comentarios = criarComentariosServico({
    repositorio: criarComentariosRepositorio(banco),
    consultas: criarConsultasComentariosRepositorio(banco),
    projetos,
    classificacao,
  });
  return {
    fila,
    uploads: montarUploads(entrada, projetos, trabalhos),
    custo,
    classificacao,
    comentarios,
  };
}

function montarExecutor(
  entrada: EntradaDaComposicao,
  nucleo: Nucleo,
  google: Google,
): ExecutorTrabalhos {
  const { registrador, relogio, opcoes } = entrada;
  const { fila, uploads, custo, classificacao } = nucleo;
  const recuperacao = criarRecuperacaoTrabalhos({
    fila,
    ganchos: [
      { nome: 'limpeza-envios', executar: uploads.limpeza },
      {
        nome: 'liberar-reservas-antigas',
        executar: () => custo.liberarReservasAntigas().then(() => undefined),
      },
      {
        nome: 'reavaliar-jobs-pausados',
        executar: () => custo.reavaliarJobsPausados().then(() => undefined),
      },
      ...(opcoes.ganchosDeRecuperacao ?? []),
    ],
    relogio,
    registrador,
  });
  return criarExecutorTrabalhos({
    fila,
    recuperacao,
    manipuladores: {
      import_upload: criarManipuladorImportarEnvio(uploads.importacao),
      classify: criarManipuladorClassificar(classificacao),
      google_sync: google.manipulador,
      ...opcoes.manipuladoresDeTrabalho,
    },
    relogio,
    registrador,
    ...opcoes.ajustesDoExecutor,
  });
}

function montarExclusao(
  entrada: EntradaDaComposicao,
  base: Pick<ServicosDaAplicacao, 'contas' | 'usuarios' | 'projetos'>,
  nucleo: Nucleo,
  google: Google,
): ServicosDaAplicacao['exclusao'] {
  const { projetos, contas, usuarios } = base;
  const { registrador, opcoes } = entrada;
  return criarExclusaoDadosServico({
    projetos,
    contas,
    usuarios,
    encerradorDeSessoes: entrada.armazenamentoDeSessao,
    registrador,
    passosAntesDeEncerrarConta: [
      (contaId) => google.oauth.revogarDaConta(contaId),
      (contaId) => nucleo.uploads.armazenamento.apagarPastaDaConta(contaId),
      ...(opcoes.passosAntesDeEncerrarConta ?? []),
    ],
    passosAntesDeApagarProjeto: [
      (contaId, projetoId) => google.oauth.revogarDoProjeto(contaId, projetoId),
    ],
  });
}

export function compor(base: EntradaBase): Composicao {
  const entrada: EntradaDaComposicao = {
    ...base,
    enviador: base.opcoes.enviadorDeEmail ?? criarEnviador(base.configuracao, base.registrador),
  };
  const { banco, registrador } = entrada;
  const provedorDeCobranca = escolherProvedorDeCobranca(entrada.configuracao.cobrancaAtivada);
  const dependenciasDeAuth = montarDependenciasDeAuth(entrada);
  const contas = criarContasServico(criarContasRepositorio(banco));
  const usuarios = criarUsuariosServico(dependenciasDeAuth);
  const projetos = criarProjetosServico(criarProjetosRepositorio(banco));
  const trabalhos = criarTrabalhosServico(criarTrabalhosRepositorio(banco));
  const nucleo = montarNucleo(entrada, projetos, trabalhos, usuarios);
  const google = montarGoogle(entrada, { projetos, trabalhos, comentarios: nucleo.comentarios });
  const servicos: ServicosDaAplicacao = {
    autenticacao: criarAutenticacaoServico(dependenciasDeAuth),
    convites: criarConvitesServico(dependenciasDeAuth, contas),
    perfil: criarPerfilServico(dependenciasDeAuth),
    usuarios,
    contas,
    planos: criarPlanosServico(criarPlanosSistemaRepositorio(banco)),
    projetos,
    trabalhos,
    envios: nucleo.uploads.envios,
    controleDeCusto: nucleo.custo,
    classificacao: nucleo.classificacao,
    comentarios: nucleo.comentarios,
    painel: criarPainelServico(nucleo.comentarios),
    exportacao: criarExportacaoServico({
      comentarios: nucleo.comentarios,
      projetos,
      registrador,
    }),
    exclusao: montarExclusao(entrada, { contas, usuarios, projetos }, nucleo, google),
    googleOauth: google.oauth,
    googleUnidades: google.unidades,
  };
  const agendador = montarAgendadorDoSistema({
    ...entrada,
    custo: nucleo.custo,
    limparEnviosOrfaos: nucleo.uploads.limpeza,
    sincronizarGoogle: () => sincronizarGoogleAgendado(google.sistema, trabalhos),
  });
  return {
    servicos,
    executorDeTrabalhos: montarExecutor(entrada, nucleo, google),
    agendador,
    provedorDeCobranca,
  };
}
