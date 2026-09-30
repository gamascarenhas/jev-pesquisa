import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoProjetoId } from '../../shared/ids.js';
import {
  esquemaCorpoDeProjeto,
  esquemaListagemDeProjetos,
  esquemaParametrosDeProjeto,
  paraProjetoDto,
} from './projetos.esquemas.js';
import type { ProjetosServico } from './projetos.servico.js';

export interface DependenciasProjetosRotas {
  servico: ProjetosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

export function registrarRotasDeProjetos(
  app: FastifyInstance,
  { servico, exigirAutenticacao }: DependenciasProjetosRotas,
): void {
  const opcoes = { preHandler: [exigirAutenticacao] };

  app.post('/projetos', opcoes, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const { nome } = esquemaCorpoDeProjeto.parse(requisicao.body);
    const projeto = await servico.criar(contaId, usuarioId, nome);
    return resposta.status(201).send(paraProjetoDto(projeto));
  });

  app.get('/projetos', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const pagina = await servico.listar(contaId, esquemaListagemDeProjetos.parse(requisicao.query));
    return { ...pagina, itens: pagina.itens.map(paraProjetoDto) };
  });

  app.patch('/projetos/:id', opcoes, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const { id } = esquemaParametrosDeProjeto.parse(requisicao.params);
    const { nome } = esquemaCorpoDeProjeto.parse(requisicao.body);
    return paraProjetoDto(await servico.renomear(contaId, comoProjetoId(id), nome));
  });
}
