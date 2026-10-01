import Anthropic, { APIConnectionError, APIError, APIUserAbortError } from '@anthropic-ai/sdk';

import { ErroDeIaAmbiguo, ErroDeIaNaoCobrado } from '../../modules/usage/controle-custo.servico.js';
import type { OpcoesDoLlm, ProvedorLlm, RequisicaoLlm, RespostaLlm } from './provedor-llm.js';

export const TEMPO_LIMITE_LLM_MS = 60_000;
const STATUS_ERRO_DO_SERVIDOR = 500;
// Respostas que o provedor devolve antes de processar o pedido, portanto sem cobrança.
const STATUS_SEM_COBRANCA = new Set([400, 401, 403, 404, 413, 422, 429]);

export interface OpcoesDoProvedorAnthropic {
  chaveApi: string;
  modelo: string;
  fetch?: typeof fetch | undefined;
}

// Falha antes do processamento não cobra; timeout, queda e 5xx podem ter cobrado, então valem a estimativa.
function traduzirErro(erro: unknown): unknown {
  if (erro instanceof APIUserAbortError) {
    return erro;
  }
  if (erro instanceof APIError && erro.status !== undefined) {
    const status = Number(erro.status);
    return STATUS_SEM_COBRANCA.has(status) && status < STATUS_ERRO_DO_SERVIDOR
      ? new ErroDeIaNaoCobrado()
      : new ErroDeIaAmbiguo();
  }
  return erro instanceof APIConnectionError ? new ErroDeIaAmbiguo() : erro;
}

class ProvedorAnthropic implements ProvedorLlm {
  private readonly cliente: Anthropic;

  constructor(private readonly opcoes: OpcoesDoProvedorAnthropic) {
    // A repetição fica por conta de quem chama: o custo de cada tentativa precisa ser reservado.
    this.cliente = new Anthropic({
      apiKey: opcoes.chaveApi,
      maxRetries: 0,
      timeout: TEMPO_LIMITE_LLM_MS,
      ...(opcoes.fetch === undefined ? {} : { fetch: opcoes.fetch }),
    });
  }

  async gerar(requisicao: RequisicaoLlm, opcoes: OpcoesDoLlm = {}): Promise<RespostaLlm> {
    try {
      const resposta = await this.cliente.messages.create(
        {
          model: this.opcoes.modelo,
          max_tokens: requisicao.maximoDeTokens,
          temperature: requisicao.temperatura,
          system: requisicao.sistema,
          messages: [{ role: 'user', content: requisicao.usuario }],
        },
        { signal: opcoes.sinal ?? null, timeout: TEMPO_LIMITE_LLM_MS },
      );
      const texto = resposta.content
        .flatMap((bloco) => (bloco.type === 'text' ? [bloco.text] : []))
        .join('');
      return {
        texto,
        modelo: resposta.model,
        uso: {
          tokensEntrada: resposta.usage.input_tokens,
          tokensSaida: resposta.usage.output_tokens,
        },
      };
    } catch (erro) {
      throw traduzirErro(erro);
    }
  }
}

export function criarProvedorAnthropic(opcoes: OpcoesDoProvedorAnthropic): ProvedorLlm {
  return new ProvedorAnthropic(opcoes);
}
