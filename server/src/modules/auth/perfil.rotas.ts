import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import {
  LIMITES,
  limitePorEmail,
  limitePorIp,
  limitePorUsuario,
} from '../../http/plugins/limite-requisicoes.plugin.js';
import {
  esquemaTrocarEmail,
  esquemaTrocarSenha,
  MENSAGEM_SE_O_EMAIL_EXISTIR,
} from './autenticacao.esquemas.js';
import type { PerfilServico } from './perfil.servico.js';

export interface DependenciasPerfilRotas {
  servico: PerfilServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDePerfil(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasPerfilRotas,
): void {
  const confirmacao = limitePorUsuario(app, 'confirmacao-senha', LIMITES.confirmacaoDeSenha);
  const troca = LIMITES.trocaEmail;

  app.post(
    '/perfil/senha',
    { preHandler: [exigirAutenticacao, confirmacao] },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const entrada = esquemaTrocarSenha.parse(requisicao.body);
      await servico.trocarSenha(contaId, usuarioId, entrada, requisicao.session.sessionId);
      return resposta.status(204).send();
    },
  );

  app.post(
    '/perfil/email',
    {
      ...limitePorIp(troca.porIp),
      preHandler: [
        exigirAutenticacao,
        confirmacao,
        limitePorEmail(app, 'troca-email', troca.porEmail),
      ],
    },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const entrada = esquemaTrocarEmail.parse(requisicao.body);
      await servico.solicitarTrocaDeEmail(contaId, usuarioId, entrada);
      return resposta.status(202).send({ mensagem: MENSAGEM_SE_O_EMAIL_EXISTIR });
    },
  );
}
