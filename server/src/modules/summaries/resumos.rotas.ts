import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { comoProjetoId } from '../../shared/ids.js';
import {
  esquemaEntradaDoResumo,
  esquemaParametrosDoAchado,
  esquemaParametrosDoProjeto,
  paraCitadosDto,
  paraListaDto,
} from './resumos.esquemas.js';
import type { ResumosServico } from './resumos.servico.js';

export interface DependenciasResumosRotas {
  servico: ResumosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirEmailConfirmado: preHandlerAsyncHookHandler;
}

const BASE = '/projetos/:projetoId/resumos';

export function registrarRotasDeResumos(
  app: FastifyInstance,
  { servico, exigirAutenticacao, exigirEmailConfirmado }: DependenciasResumosRotas,
): void {
  // Gerar consome IA e exige e-mail confirmado; consultar o que já existe não consome.
  app.post(BASE, { preHandler: [exigirAutenticacao, exigirEmailConfirmado] }, async (req, res) => {
    const { contaId, usuarioId } = obterContexto(req);
    const { projetoId } = esquemaParametrosDoProjeto.parse(req.params);
    const entrada = esquemaEntradaDoResumo.parse(req.body ?? {});
    const inicio = await servico.iniciar(contaId, usuarioId, comoProjetoId(projetoId), entrada);
    return res.status(inicio.jaExistia ? 200 : 202).send({ trabalhoId: inicio.trabalhoId });
  });

  app.get(BASE, { preHandler: [exigirAutenticacao] }, async (req) => {
    const { contaId } = obterContexto(req);
    const { projetoId } = esquemaParametrosDoProjeto.parse(req.params);
    return paraListaDto(await servico.listar(contaId, comoProjetoId(projetoId)));
  });

  app.get(
    `${BASE}/:resumoId/achados/:indice/comentarios`,
    { preHandler: [exigirAutenticacao] },
    async (req) => {
      const { contaId } = obterContexto(req);
      const { projetoId, resumoId, indice } = esquemaParametrosDoAchado.parse(req.params);
      const citados = await servico.evidencias(contaId, comoProjetoId(projetoId), resumoId, indice);
      return paraCitadosDto(citados);
    },
  );
}
