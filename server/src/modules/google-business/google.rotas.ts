import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { ErroDeDominio } from '../../shared/errors.js';
import { comoProjetoId, type ProjetoId } from '../../shared/ids.js';
import {
  esquemaConsultaDoCallback,
  esquemaEscolhaDeUnidades,
  esquemaParametrosDoProjeto,
  paraContasDto,
  paraStatusDto,
} from './google.esquemas.js';
import type { GoogleOauthServico } from './google-oauth.servico.js';
import type { GoogleUnidadesServico } from './google-unidades.servico.js';

export interface DependenciasGoogleRotas {
  oauth: GoogleOauthServico;
  unidades: GoogleUnidadesServico;
  urlApp: string;
  exigirAutenticacao: preHandlerAsyncHookHandler;
  exigirDono: preHandlerAsyncHookHandler;
}

const BASE = '/projetos/:projetoId/google';

function projetoDaRota(requisicao: FastifyRequest): ProjetoId {
  return comoProjetoId(esquemaParametrosDoProjeto.parse(requisicao.params).projetoId);
}

function urlDeRetorno(urlApp: string, projetoId: string, erro?: string): string {
  const consulta = erro === undefined ? '' : `?erro=${erro}`;
  return `${urlApp}/projetos/${projetoId}/google${consulta}`;
}

async function concluirCallback(
  { oauth, urlApp }: DependenciasGoogleRotas,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
): Promise<FastifyReply> {
  const { contaId, usuarioId } = obterContexto(requisicao);
  const { code, state, error } = esquemaConsultaDoCallback.parse(requisicao.query);
  const guardado = requisicao.session.googleEstado;
  requisicao.session.set('googleEstado', undefined);
  if (error !== undefined || !code || !state) {
    return resposta.redirect(urlDeRetorno(urlApp, guardado?.projetoId ?? '', 'google_negado'));
  }
  try {
    const projetoId = await oauth.concluir(contaId, usuarioId, guardado, { state, code });
    return await resposta.redirect(urlDeRetorno(urlApp, projetoId));
  } catch (erro) {
    if (guardado === undefined || !(erro instanceof ErroDeDominio)) {
      throw erro;
    }
    if (erro.codigo === 'google_estado_invalido') {
      throw erro;
    }
    return resposta.redirect(urlDeRetorno(urlApp, guardado.projetoId, erro.codigo));
  }
}

function registrarConexao(app: FastifyInstance, dep: DependenciasGoogleRotas): void {
  const { oauth, unidades, exigirAutenticacao, exigirDono } = dep;
  const somenteDono = { preHandler: [exigirAutenticacao, exigirDono] };

  app.get(BASE, { preHandler: [exigirAutenticacao] }, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    return paraStatusDto(await unidades.status(contaId, projetoDaRota(requisicao)));
  });

  app.post(`${BASE}/conectar`, somenteDono, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    const inicio = await oauth.iniciar(contaId, projetoDaRota(requisicao));
    requisicao.session.set('googleEstado', inicio.estado);
    return { url: inicio.url };
  });

  // Destino do redirecionamento do Google: o projeto vem do estado da sessão, nunca da URL.
  app.get('/google/callback', somenteDono, (requisicao, resposta) =>
    concluirCallback(dep, requisicao, resposta),
  );

  app.delete(BASE, somenteDono, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    await oauth.desconectar(contaId, usuarioId, projetoDaRota(requisicao));
    return resposta.status(204).send();
  });
}

function registrarUnidades(app: FastifyInstance, dep: DependenciasGoogleRotas): void {
  const { unidades, exigirAutenticacao, exigirDono } = dep;
  const somenteDono = { preHandler: [exigirAutenticacao, exigirDono] };

  app.get(`${BASE}/unidades`, somenteDono, async (requisicao) => {
    const { contaId } = obterContexto(requisicao);
    return paraContasDto(await unidades.listarDisponiveis(contaId, projetoDaRota(requisicao)));
  });

  app.put(`${BASE}/unidades`, somenteDono, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const entrada = esquemaEscolhaDeUnidades.parse(requisicao.body);
    const projetoId = projetoDaRota(requisicao);
    const inicio = await unidades.selecionar(contaId, usuarioId, projetoId, entrada.unidades);
    return resposta.status(202).send({ trabalhoId: inicio.trabalhoId });
  });

  app.post(`${BASE}/sincronizar`, somenteDono, async (requisicao, resposta) => {
    const { contaId, usuarioId } = obterContexto(requisicao);
    const inicio = await unidades.sincronizar(contaId, usuarioId, projetoDaRota(requisicao));
    return resposta.status(inicio.jaExistia ? 200 : 202).send({ trabalhoId: inicio.trabalhoId });
  });
}

export function registrarRotasDoGoogle(app: FastifyInstance, dep: DependenciasGoogleRotas): void {
  registrarConexao(app, dep);
  registrarUnidades(app, dep);
}
