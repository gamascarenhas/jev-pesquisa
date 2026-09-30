import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { ErroDeDominio, montarCorpoDeErro } from '../../shared/errors.js';

const MENSAGEM_ERRO_INTERNO = 'Erro interno do servidor.';

const MENSAGENS_POR_STATUS: Record<number, { codigo: string; mensagem: string }> = {
  400: { codigo: 'requisicao_invalida', mensagem: 'Requisição inválida.' },
  401: { codigo: 'nao_autenticado', mensagem: 'Autenticação necessária.' },
  403: { codigo: 'proibido', mensagem: 'Ação não permitida.' },
  404: { codigo: 'nao_encontrado', mensagem: 'Recurso não encontrado.' },
  413: { codigo: 'corpo_grande_demais', mensagem: 'O corpo da requisição é grande demais.' },
  415: { codigo: 'tipo_nao_suportado', mensagem: 'Tipo de conteúdo não suportado.' },
  429: {
    codigo: 'muitas_requisicoes',
    mensagem: 'Muitas requisições. Tente novamente em instantes.',
  },
};

const ERRO_CLIENTE_GENERICO = MENSAGENS_POR_STATUS[400] ?? {
  codigo: 'requisicao_invalida',
  mensagem: 'Requisição inválida.',
};

interface RespostaDeErro {
  status: number;
  codigo: string;
  mensagem: string;
}

function statusDoErroNativo(erro: FastifyError): number | undefined {
  const { statusCode } = erro;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

function traduzir(erro: unknown, estaEmProducao: boolean): RespostaDeErro {
  if (erro instanceof ErroDeDominio) {
    return { status: erro.statusHttp, codigo: erro.codigo, mensagem: erro.message };
  }
  if (erro instanceof ZodError) {
    return { status: 400, codigo: 'entrada_invalida', mensagem: 'Dados de entrada inválidos.' };
  }
  const status = statusDoErroNativo(erro as FastifyError);
  if (status !== undefined) {
    const padrao = MENSAGENS_POR_STATUS[status] ?? ERRO_CLIENTE_GENERICO;
    return { status, ...padrao };
  }
  // Inesperado: genérico em produção, mensagem técnica em desenvolvimento.
  const detalhe = erro instanceof Error ? erro.message : MENSAGEM_ERRO_INTERNO;
  return {
    status: 500,
    codigo: 'erro_interno',
    mensagem: estaEmProducao ? MENSAGEM_ERRO_INTERNO : detalhe,
  };
}

function registrarNoLog(requisicao: FastifyRequest, erro: unknown, resposta: RespostaDeErro): void {
  const dados = { err: erro, codigo: resposta.codigo, status: resposta.status };
  if (resposta.status >= 500) {
    requisicao.log.error(dados, 'erro inesperado na requisição');
  } else {
    requisicao.log.warn(
      { codigo: resposta.codigo, status: resposta.status },
      'requisição recusada',
    );
  }
}

export function registrarManipuladorDeErros(app: FastifyInstance, estaEmProducao: boolean): void {
  app.setErrorHandler((erro: unknown, requisicao: FastifyRequest, resposta: FastifyReply) => {
    const traduzido = traduzir(erro, estaEmProducao);
    registrarNoLog(requisicao, erro, traduzido);
    void resposta
      .status(traduzido.status)
      .send(montarCorpoDeErro(traduzido.codigo, traduzido.mensagem, requisicao.id));
  });

  app.setNotFoundHandler((requisicao, resposta) => {
    const padrao = MENSAGENS_POR_STATUS[404] ?? ERRO_CLIENTE_GENERICO;
    void resposta
      .status(404)
      .send(montarCorpoDeErro(padrao.codigo, padrao.mensagem, requisicao.id));
  });
}
