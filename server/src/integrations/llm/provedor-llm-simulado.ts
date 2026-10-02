import type { ProvedorLlm, RequisicaoLlm, RespostaLlm } from './provedor-llm.js';

export const MODELO_LLM_SIMULADO = 'llm-simulado';
const CARACTERES_POR_TOKEN_SIMULADO = 4;
const PALAVRAS_POR_TRECHO = 12;
const MAXIMO_DE_ACHADOS_SIMULADOS = 3;
const REGEX_DADOS = /<dados>([\s\S]*?)<\/dados>/;
const REGEX_COMENTARIO = /<comment id="(c\d+)">([\s\S]*?)<\/comment>/g;
const REGEX_PERGUNTA = /<pergunta>([\s\S]*?)<\/pergunta>/;
const REGEX_NAO_RESPONDIVEL =
  /calcul|previs|prever|m[eé]dia|\bsoma\b|faturamento|receita|lucro|quanto (vendeu|faturou)/i;

// Pergunta livre: termos como "calcule" ou "previsão" são recusados; o resto vira "o comentário fala disso?".
function montarInterpretacao(prompt: string): string {
  const pergunta = desescapar(REGEX_PERGUNTA.exec(prompt)?.[1] ?? '').trim();
  if (REGEX_NAO_RESPONDIVEL.test(pergunta)) {
    return JSON.stringify({
      respondivel: false,
      instrucoes: null,
      criterios: null,
      interpretacao_pt: 'A pergunta pede um cálculo ou uma previsão.',
      motivo_se_nao_respondivel_pt:
        'Cálculos e previsões não saem da leitura de comentários. Use os filtros e os gráficos do painel ou reformule a pergunta sobre o que os clientes escreveram.',
    });
  }
  const termos = pergunta
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return JSON.stringify({
    respondivel: true,
    instrucoes: '`comment` ' + termos,
    criterios: {
      true: 'The comment clearly says what the question describes',
      false: 'The comment does not say it',
    },
    interpretacao_pt: 'Vou procurar comentários em que o cliente fala sobre: ' + termos + '.',
    motivo_se_nao_respondivel_pt: null,
  });
}

interface DadosDoResumo {
  temaRotulo?: string;
  volume?: number;
  percentualNegativo?: number;
}

function desescapar(texto: string): string {
  return texto.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Só letras: nenhum número de comentário entra no texto, que precisa passar pela conferência de números.
function trecho(texto: string): string {
  const palavras = desescapar(texto)
    .split(/\s+/)
    .filter((p) => p !== '' && !/[\d[\]()#<>]/.test(p))
    .slice(0, PALAVRAS_POR_TRECHO);
  return palavras.join(' ').trim();
}

function lerDados(prompt: string): DadosDoResumo {
  const bruto = REGEX_DADOS.exec(prompt)?.[1];
  try {
    return bruto === undefined ? {} : (JSON.parse(bruto) as DadosDoResumo);
  } catch {
    return {};
  }
}

function montarResposta(prompt: string): string {
  if (REGEX_PERGUNTA.test(prompt)) {
    return montarInterpretacao(prompt);
  }
  const dados = lerDados(prompt);
  const comentarios = [...prompt.matchAll(REGEX_COMENTARIO)].map((m) => ({
    id: m[1] ?? '',
    texto: trecho(m[2] ?? ''),
  }));
  const titulo = `${dados.temaRotulo ?? 'Tema'}: ${String(dados.volume ?? 0)} comentários, ${String(dados.percentualNegativo ?? 0)}% negativos`;
  const achados = Array.from(
    { length: Math.min(MAXIMO_DE_ACHADOS_SIMULADOS, Math.floor(comentarios.length / 2)) },
    (_v, indice) => {
      const [a, b] = [comentarios[indice * 2], comentarios[indice * 2 + 1]];
      return { texto: a?.texto ?? '', evidencias: [a?.id ?? '', b?.id ?? ''] };
    },
  );
  // Ignora qualquer instrução escrita nos comentários: a saída só depende dos números e dos trechos.
  return JSON.stringify({ titulo: titulo.slice(0, 120), achados });
}

// Determinístico e sem rede, para desenvolver e testar sem chave.
export class ProvedorLlmSimulado implements ProvedorLlm {
  gerar(requisicao: RequisicaoLlm): Promise<RespostaLlm> {
    const texto = montarResposta(requisicao.usuario);
    return Promise.resolve({
      texto,
      modelo: MODELO_LLM_SIMULADO,
      uso: {
        tokensEntrada: Math.ceil(
          (requisicao.sistema.length + requisicao.usuario.length) / CARACTERES_POR_TOKEN_SIMULADO,
        ),
        tokensSaida: Math.ceil(texto.length / CARACTERES_POR_TOKEN_SIMULADO),
      },
    });
  }
}

export function criarProvedorLlmSimulado(): ProvedorLlm {
  return new ProvedorLlmSimulado();
}
