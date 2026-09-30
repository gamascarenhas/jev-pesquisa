import type { FastifyInstance } from 'fastify';

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
import type { Relogio } from '../shared/clock.js';
import { registrarRotaConfiguracaoPublica } from './configuracao-publica.rotas.js';
import { criarExigirAutenticacao } from './guards/exigir-autenticacao.js';
import { exigirDono } from './guards/exigir-dono.js';
import { registrarRotaSaude, type DependenciasSaude } from './saude.rotas.js';

export interface ServicosDaAplicacao {
  autenticacao: AutenticacaoServico;
  convites: ConvitesServico;
  perfil: PerfilServico;
  usuarios: UsuariosServico;
  contas: ContasServico;
  planos: PlanosServico;
  projetos: ProjetosServico;
  exclusao: ExclusaoDadosServico;
}

export interface DependenciasRotas extends DependenciasSaude {
  nomeNegocio: string;
  relogio: Relogio;
  servicos: ServicosDaAplicacao;
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
  registrarRotasDeExclusao(api, { servico: servicos.exclusao, exigirAutenticacao, exigirDono });
}

export async function registrarRotas(
  app: FastifyInstance,
  dependencias: DependenciasRotas,
): Promise<void> {
  await app.register(
    (api, _opcoes, pronto) => {
      registrarRotaConfiguracaoPublica(api, { nomeNegocio: dependencias.nomeNegocio });
      registrarRotaSaude(api, { verificarBanco: dependencias.verificarBanco });
      registrarRotasDeNegocio(api, dependencias);
      pronto();
    },
    { prefix: '/api' },
  );
}
