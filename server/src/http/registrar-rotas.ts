import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import type { ContasServico } from '../modules/accounts/contas.servico.js';
import { registrarRotasDeContas } from '../modules/accounts/contas.rotas.js';
import type { AutenticacaoServico } from '../modules/auth/autenticacao.servico.js';
import { registrarRotasDeAutenticacao } from '../modules/auth/autenticacao.rotas.js';
import type { ConvitesServico } from '../modules/auth/convites.servico.js';
import { registrarRotasDeConvites } from '../modules/auth/convites.rotas.js';
import type { PerfilServico } from '../modules/auth/perfil.servico.js';
import { registrarRotasDePerfil } from '../modules/auth/perfil.rotas.js';
import type { UsuariosServico } from '../modules/auth/usuarios.servico.js';
import { registrarRotasDeUsuarios } from '../modules/auth/usuarios.rotas.js';
import { registrarRotasDeExclusao } from '../modules/data-deletion/exclusao-dados.rotas.js';
import type { ExclusaoDadosServico } from '../modules/data-deletion/exclusao-dados.servico.js';
import type { PlanosServico } from '../modules/plans/planos.servico.js';
import { registrarRotasDePlanos } from '../modules/plans/planos.rotas.js';
import { registrarRotasDeProjetos } from '../modules/projects/projetos.rotas.js';
import type { ProjetosServico } from '../modules/projects/projetos.servico.js';
import { registrarRotasDeTrabalhos } from '../jobs/trabalhos.rotas.js';
import type { TrabalhosServico } from '../jobs/trabalhos.servico.js';
import { registrarRotasDeConsumo } from '../modules/usage/consumo.rotas.js';
import { registrarRotasDeClassificacao } from '../modules/classification/classificacao.rotas.js';
import type { ClassificacaoServico } from '../modules/classification/classificacao.servico.js';
import { registrarRotasDeComentarios } from '../modules/comments/comentarios.rotas.js';
import type { ComentariosServico } from '../modules/comments/comentarios.servico.js';
import { registrarRotasDePerguntar } from '../modules/ask/perguntar.rotas.js';
import type { PerguntarServico } from '../modules/ask/perguntar.servico.js';
import { registrarRotasDeResumos } from '../modules/summaries/resumos.rotas.js';
import type { ResumosServico } from '../modules/summaries/resumos.servico.js';
import { registrarRotasDoGoogle } from '../modules/google-business/google.rotas.js';
import type { GoogleOauthServico } from '../modules/google-business/google-oauth.servico.js';
import type { GoogleUnidadesServico } from '../modules/google-business/google-unidades.servico.js';
import type { ExportacaoServico } from '../modules/dashboard/exportacao.servico.js';
import type { PainelServico } from '../modules/dashboard/painel.servico.js';
import { registrarRotasDoPainel } from '../modules/dashboard/painel.rotas.js';
import { registrarRotasDeEnvios } from '../modules/uploads/envios.rotas.js';
import type { EnviosServico } from '../modules/uploads/envios.servico.js';
import type { ControleDeCusto } from '../modules/usage/controle-custo.servico.js';
import type { Relogio } from '../shared/clock.js';
import { registrarRotaConfiguracaoPublica } from './configuracao-publica.rotas.js';
import { criarExigirAutenticacao } from './guards/exigir-autenticacao.js';
import { exigirDono } from './guards/exigir-dono.js';
import { exigirEmailConfirmado } from './guards/exigir-email-confirmado.js';
import { registrarRotaSaude, type DependenciasSaude } from './saude.rotas.js';

export interface ServicosDaAplicacao {
  autenticacao: AutenticacaoServico;
  convites: ConvitesServico;
  perfil: PerfilServico;
  usuarios: UsuariosServico;
  contas: ContasServico;
  planos: PlanosServico;
  projetos: ProjetosServico;
  trabalhos: TrabalhosServico;
  envios: EnviosServico;
  controleDeCusto: ControleDeCusto;
  classificacao: ClassificacaoServico;
  comentarios: ComentariosServico;
  painel: PainelServico;
  exportacao: ExportacaoServico;
  exclusao: ExclusaoDadosServico;
  googleOauth: GoogleOauthServico;
  googleUnidades: GoogleUnidadesServico;
  resumos: ResumosServico;
  perguntar: PerguntarServico;
}

export interface DependenciasRotas extends DependenciasSaude {
  nomeNegocio: string;
  urlApp: string;
  cobrancaAtivada: boolean;
  relogio: Relogio;
  servicos: ServicosDaAplicacao;
}

// Resumos, perguntas e Google: tudo que fala com serviços de IA ou externos.
function registrarRotasDeIa(
  api: FastifyInstance,
  dependencias: DependenciasRotas,
  exigirAutenticacao: preHandlerAsyncHookHandler,
): void {
  const { servicos } = dependencias;
  registrarRotasDeResumos(api, {
    servico: servicos.resumos,
    exigirAutenticacao,
    exigirEmailConfirmado,
  });
  registrarRotasDePerguntar(api, {
    servico: servicos.perguntar,
    exigirAutenticacao,
    exigirEmailConfirmado,
  });
  registrarRotasDoGoogle(api, {
    oauth: servicos.googleOauth,
    unidades: servicos.googleUnidades,
    urlApp: dependencias.urlApp,
    exigirAutenticacao,
    exigirDono,
  });
}

function registrarRotasDeNegocio(api: FastifyInstance, dependencias: DependenciasRotas): void {
  const { servicos, relogio } = dependencias;
  const exigirAutenticacao = criarExigirAutenticacao((contaId, usuarioId) =>
    servicos.autenticacao.carregarContexto(contaId, usuarioId),
  );

  registrarRotasDeAutenticacao(api, {
    servico: servicos.autenticacao,
    convites: servicos.convites,
    perfil: servicos.perfil,
    exigirAutenticacao,
    relogio,
  });
  registrarRotasDeConvites(api, { servico: servicos.convites, exigirAutenticacao, exigirDono });
  registrarRotasDeUsuarios(api, { servico: servicos.usuarios, exigirAutenticacao, exigirDono });
  registrarRotasDePerfil(api, { servico: servicos.perfil, exigirAutenticacao });
  registrarRotasDeContas(api, { servico: servicos.contas, exigirAutenticacao });
  registrarRotasDePlanos(api, { servico: servicos.planos, exigirAutenticacao });
  registrarRotasDeProjetos(api, { servico: servicos.projetos, exigirAutenticacao });
  registrarRotasDeClassificacao(api, {
    servico: servicos.classificacao,
    exigirAutenticacao,
    exigirEmailConfirmado,
  });
  registrarRotasDeConsumo(api, { servico: servicos.controleDeCusto, exigirAutenticacao });
  registrarRotasDeComentarios(api, { servico: servicos.comentarios, exigirAutenticacao });
  registrarRotasDoPainel(api, {
    painel: servicos.painel,
    exportacao: servicos.exportacao,
    exigirAutenticacao,
  });
  registrarRotasDeIa(api, dependencias, exigirAutenticacao);
  registrarRotasDeEnvios(api, { servico: servicos.envios, exigirAutenticacao });
  registrarRotasDeTrabalhos(api, { servico: servicos.trabalhos, exigirAutenticacao });
  registrarRotasDeExclusao(api, { servico: servicos.exclusao, exigirAutenticacao, exigirDono });
}

export async function registrarRotas(
  app: FastifyInstance,
  dependencias: DependenciasRotas,
): Promise<void> {
  await app.register(
    (api, _opcoes, pronto) => {
      registrarRotaConfiguracaoPublica(api, {
        nomeNegocio: dependencias.nomeNegocio,
        cobrancaAtivada: dependencias.cobrancaAtivada,
      });
      registrarRotaSaude(api, { verificarBanco: dependencias.verificarBanco });
      registrarRotasDeNegocio(api, dependencias);
      pronto();
    },
    { prefix: '/api' },
  );
}
