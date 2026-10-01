export interface RequisicaoLlm {
  sistema: string;
  usuario: string;
  maximoDeTokens: number;
  temperatura: number;
}

export interface RespostaLlm {
  texto: string;
  modelo: string;
  uso: { tokensEntrada: number; tokensSaida: number };
}

export interface OpcoesDoLlm {
  sinal?: AbortSignal | undefined;
}

// Atrás desta interface mora qualquer provedor; os usos futuros do LLM reaproveitam a mesma porta.
export interface ProvedorLlm {
  gerar(requisicao: RequisicaoLlm, opcoes?: OpcoesDoLlm): Promise<RespostaLlm>;
}
