import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { LIMITES, limitePorUsuario } from '../../http/plugins/limite-requisicoes.plugin.js';
import { comoProjetoId } from '../../shared/ids.js';
import {
  esquemaApagarProjeto,
  esquemaEncerrarConta,
  esquemaParametrosApagarProjeto,
} from './exclusao-dados.esquemas.js';
import type { ExclusaoDadosServico } from './exclusao-dados.servico.js';

export interface DependenciasExclusaoRotas {
  servico: ExclusaoDadosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirDono: preHandlerAsyncHookHandler;
}

export function registrarRotasDeExclusao(
  app: FastifyInstance,
  { servico, exigirAutenticacao, exigirDono }: DependenciasExclusaoRotas,
): void {
  app.delete(
    '/projetos/:id',
    { preHandler: [exigirAutenticacao, exigirDono] },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const { id } = esquemaParametrosApagarProjeto.parse(requisicao.params);
      const { nomeProjeto } = esquemaApagarProjeto.parse(requisicao.body);
      await servico.apagarProjeto(contaId, usuarioId, comoProjetoId(id), nomeProjeto);
      return resposta.status(204).send();
    },
  );

  const confirmacao = limitePorUsuario(app, 'confirmacao-senha', LIMITES.confirmacaoDeSenha);
  app.delete(
    '/conta',
    { preHandler: [exigirAutenticacao, exigirDono, confirmacao] },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const { senha } = esquemaEncerrarConta.parse(requisicao.body);
      await servico.encerrarConta(contaId, usuarioId, senha);
      await requisicao.session.destroy();
      return resposta.status(204).send();
    },
  );
}
