import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoUsuarioId } from '../../shared/ids.js';
import { esquemaParametrosComId, paraUsuarioDto } from './autenticacao.esquemas.js';
import type { UsuariosServico } from './usuarios.servico.js';

export interface DependenciasUsuariosRotas {
  servico: UsuariosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirDono: preHandlerAsyncHookHandler;
}

export function registrarRotasDeUsuarios(
  app: FastifyInstance,
  { servico, exigirAutenticacao, exigirDono }: DependenciasUsuariosRotas,
): void {
  const opcoes = { preHandler: [exigirAutenticacao, exigirDono] };

  app.get('/usuarios', opcoes, async (requisicao) => {
    const usuarios = await servico.listar(obterContexto(requisicao).contaId);
    return { itens: usuarios.map(paraUsuarioDto) };
  });

  app.delete('/usuarios/:id', opcoes, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { id } = esquemaParametrosComId.parse(requisicao.params);
    await servico.remover(contaId, usuarioId, comoUsuarioId(id));
    return resposta.status(204).send();
  });
}
