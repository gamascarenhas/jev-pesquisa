import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoTokenId } from '../../shared/ids.js';
import {
  esquemaConvidar,
  esquemaParametrosComId,
  paraConviteDto,
} from './autenticacao.esquemas.js';
import type { ConvitesServico } from './convites.servico.js';

export interface DependenciasConvitesRotas {
  servico: ConvitesServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirDono: preHandlerAsyncHookHandler;
}

const MENSAGEM_CONVITE = 'Convite enviado.';

export function registrarRotasDeConvites(
  app: FastifyInstance,
  { servico, exigirAutenticacao, exigirDono }: DependenciasConvitesRotas,
): void {
  const opcoes = { preHandler: [exigirAutenticacao, exigirDono] };

  app.post('/convites', opcoes, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    await servico.convidar(contaId, usuarioId, esquemaConvidar.parse(requisicao.body));
    return resposta.status(202).send({ mensagem: MENSAGEM_CONVITE });
  });

  app.get('/convites', opcoes, async (requisicao) => {
    const convites = await servico.listarPendentes(obterContexto(requisicao).contaId);
    return { itens: convites.map(paraConviteDto) };
  });

  app.delete('/convites/:id', opcoes, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { id } = esquemaParametrosComId.parse(requisicao.params);
    await servico.revogar(contaId, usuarioId, comoTokenId(id));
    return resposta.status(204).send();
  });
}
