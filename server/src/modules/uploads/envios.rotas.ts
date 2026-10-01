import multipart from '@fastify/multipart';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { obterContexto } from '../../http/guards/exigir-autenticacao.js';
import { ErroDeValidacao } from '../../shared/errors.js';
import { comoFonteId, comoProjetoId } from '../../shared/ids.js';
import {
  esquemaConfirmacao,
  esquemaConsultaDePrevia,
  esquemaParametrosDeEnvio,
  esquemaParametrosDeFonte,
  esquemaParametrosDeProjeto,
  paraFonteDto,
  paraPreviaDto,
} from './envios.esquemas.js';
import type { EnviosServico } from './envios.servico.js';
import { TAMANHO_MAXIMO_ENVIO_BYTES } from './limites-envio.js';

export interface DependenciasEnviosRotas {
  servico: EnviosServico;
  exigirAutenticacao: preHandlerAsyncHookHandler;
}

const MARGEM_DO_CORPO_BYTES = 1024 * 1024;

function rotaDeEnvio(app: FastifyInstance, dep: DependenciasEnviosRotas): void {
  app.post(
    '/projetos/:projetoId/envios',
    {
      preHandler: [dep.exigirAutenticacao],
      bodyLimit: TAMANHO_MAXIMO_ENVIO_BYTES + MARGEM_DO_CORPO_BYTES,
    },
    async (requisicao, resposta) => {
      const { contaId } = obterContexto(requisicao);
      const { projetoId } = esquemaParametrosDeProjeto.parse(requisicao.params);
      const arquivo = await requisicao.file();
      if (arquivo === undefined) {
        throw new ErroDeValidacao('Envie um arquivo.', 'arquivo_ausente');
      }
      const previa = await dep.servico.receber(contaId, comoProjetoId(projetoId), {
        nomeOriginal: arquivo.filename,
        conteudo: arquivo.file,
      });
      return resposta.status(201).send(paraPreviaDto(previa));
    },
  );
}

function rotaDePrevia(app: FastifyInstance, dep: DependenciasEnviosRotas): void {
  app.get(
    '/projetos/:projetoId/envios/:envioId/previa',
    { preHandler: [dep.exigirAutenticacao] },
    async (requisicao) => {
      const { contaId } = obterContexto(requisicao);
      const { projetoId, envioId } = esquemaParametrosDeEnvio.parse(requisicao.params);
      const { aba } = esquemaConsultaDePrevia.parse(requisicao.query);
      const projeto = comoProjetoId(projetoId);
      return paraPreviaDto(await dep.servico.obterPrevia(contaId, projeto, envioId, aba));
    },
  );
}

function rotaDeConfirmacao(app: FastifyInstance, dep: DependenciasEnviosRotas): void {
  app.post(
    '/projetos/:projetoId/envios/:envioId/confirmar',
    { preHandler: [dep.exigirAutenticacao] },
    async (requisicao, resposta) => {
      const { contaId, usuarioId } = obterContexto(requisicao);
      const { projetoId, envioId } = esquemaParametrosDeEnvio.parse(requisicao.params);
      const corpo = esquemaConfirmacao.parse(requisicao.body);
      const projeto = comoProjetoId(projetoId);
      const { trabalhoId, fonte } = await dep.servico.confirmar(
        contaId,
        usuarioId,
        projeto,
        envioId,
        corpo,
      );
      return resposta.status(202).send({ trabalhoId, fonteId: fonte.id });
    },
  );
}

function rotaDeFonte(app: FastifyInstance, dep: DependenciasEnviosRotas): void {
  app.get(
    '/projetos/:projetoId/fontes/:fonteId',
    { preHandler: [dep.exigirAutenticacao] },
    async (requisicao) => {
      const { contaId } = obterContexto(requisicao);
      const { projetoId, fonteId } = esquemaParametrosDeFonte.parse(requisicao.params);
      const projeto = comoProjetoId(projetoId);
      return paraFonteDto(await dep.servico.obterFonte(contaId, projeto, comoFonteId(fonteId)));
    },
  );
}

export function registrarRotasDeEnvios(
  app: FastifyInstance,
  dependencias: DependenciasEnviosRotas,
): void {
  void app.register(async (escopo) => {
    await escopo.register(multipart, {
      limits: { fileSize: TAMANHO_MAXIMO_ENVIO_BYTES, files: 1, fields: 0, parts: 2 },
    });
    rotaDeEnvio(escopo, dependencias);
    rotaDePrevia(escopo, dependencias);
    rotaDeConfirmacao(escopo, dependencias);
    rotaDeFonte(escopo, dependencias);
  });
}
