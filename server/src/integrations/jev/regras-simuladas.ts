// Regras por palavra-chave da versão simulada: determinísticas, em português, sem acentos.
const TAMANHO_MINIMO_DE_PALAVRA = 4;
const CASAS_DA_PROBABILIDADE = 10_000;

export type Tema = keyof typeof PALAVRAS_DO_TEMA;

// A ordem decide o desempate: a primeira regra que combina vence.
const PALAVRAS_DO_TEMA = {
  billing_payment: [
    'cobranca',
    'cobraram',
    'fatura',
    'estorno',
    'reembolso',
    'pagamento',
    'cartao',
  ],
  wait_time: ['espera', 'demora', 'fila', 'atras', 'lent', 'aguard', 'minutos'],
  digital_channels: ['aplicativo', 'app ', 'site', 'online', 'sistema', 'chat', 'login'],
  delivery: ['entrega', 'entregador', 'rastre', 'frete', 'chegou', 'pedido'],
  product_quality: [
    'produto',
    'defeito',
    'qualidade',
    'quebr',
    'danific',
    'estrag',
    'frio',
    'comida',
  ],
  price: ['preco', 'caro', 'barato', 'valor', 'desconto', 'promo'],
  environment: ['limpeza', 'barulh', 'ambiente', 'estacionamento', 'confort', 'banheiro'],
  communication: ['informa', 'resposta', 'respond', 'comunic', 'avis', 'ninguem'],
  service: [
    'atendimento',
    'atendente',
    'funcionari',
    'educad',
    'gentil',
    'grosse',
    'equipe',
    'gerente',
  ],
} as const;

const PALAVRAS_POSITIVAS = [
  'otimo',
  'excelente',
  'adorei',
  'recomendo',
  'bom ',
  'perfeito',
  'rapido',
  'educad',
  'gostei',
  'impecavel',
  'atencios',
  'justos',
  'volto com certeza',
  'simples e funciona',
];
const PALAVRAS_NEGATIVAS = [
  'ruim',
  'pessim',
  'horrivel',
  'demor',
  'atras',
  'defeito',
  'grosse',
  'nunca mais',
  'nao volto',
  'decepc',
  'caro',
  'travou',
  'frio',
  'fila',
  'errad',
  'cobraram',
  'desorganizad',
  'fora do ar',
  'amassad',
  'barulh',
  'enorme',
  'nenhum aviso',
  'ninguem',
];
const PALAVRAS_GRAVES = [
  'procon',
  'advogado',
  'processo',
  'golpe',
  'fraude',
  'prejuizo',
  'cobraram',
  'nunca mais',
  'nao volto',
  'perdi',
  'roubo',
  'perigo',
];
const PALAVRAS_DE_FALHA = [
  'defeito',
  'erro',
  'travou',
  'atras',
  'demor',
  'frio',
  'errad',
  'fora do ar',
];

const PALAVRAS_COMUNS = new Set([
  'para',
  'como',
  'mais',
  'muito',
  'esse',
  'essa',
  'isso',
  'este',
  'esta',
  'sobre',
  'pelo',
  'pela',
  'with',
  'that',
  'this',
  'have',
  'from',
  'what',
  'does',
  'which',
  'about',
  'comment',
  'describe',
  'comentario',
  'cliente',
  'empresa',
  'there',
  'their',
]);

export interface Analise {
  tema: Tema | 'other';
  confiancaDoTema: number;
  sentimento: 'positive' | 'neutral' | 'negative' | 'mixed';
  confiancaDoSentimento: number;
  gravidade: number;
  probabilidadeDeAcao: number;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function contem(texto: string, palavras: readonly string[]): boolean {
  return palavras.some((palavra) => texto.includes(palavra));
}

function sentimentoDe(texto: string): Pick<Analise, 'sentimento' | 'confiancaDoSentimento'> {
  const positivo = contem(texto, PALAVRAS_POSITIVAS);
  const negativo = contem(texto, PALAVRAS_NEGATIVAS);
  if (positivo && negativo) {
    return { sentimento: 'mixed', confiancaDoSentimento: 0.7 };
  }
  if (positivo) {
    return { sentimento: 'positive', confiancaDoSentimento: 0.85 };
  }
  return negativo
    ? { sentimento: 'negative', confiancaDoSentimento: 0.85 }
    : { sentimento: 'neutral', confiancaDoSentimento: 0.6 };
}

function gravidadeDe(texto: string, sentimento: Analise['sentimento']): number {
  if (sentimento === 'positive' || sentimento === 'neutral') {
    return 0;
  }
  if (contem(texto, PALAVRAS_GRAVES)) {
    return 3;
  }
  return contem(texto, PALAVRAS_DE_FALHA) ? 2 : 1;
}

const PROBABILIDADE_DE_ACAO: Record<Analise['sentimento'], number> = {
  negative: 0.85,
  mixed: 0.7,
  neutral: 0.3,
  positive: 0.1,
};

export function analisar(comentario: string): Analise {
  const texto = normalizar(comentario);
  const tema = (Object.keys(PALAVRAS_DO_TEMA) as Tema[]).find((chave) =>
    contem(texto, PALAVRAS_DO_TEMA[chave]),
  );
  const sentimento = sentimentoDe(texto);
  return {
    tema: tema ?? 'other',
    confiancaDoTema: tema === undefined ? 0.4 : 0.8,
    ...sentimento,
    gravidade: gravidadeDe(texto, sentimento.sentimento),
    probabilidadeDeAcao: PROBABILIDADE_DE_ACAO[sentimento.sentimento],
  };
}

export function arredondar(valor: number): number {
  return Math.round(valor * CASAS_DA_PROBABILIDADE) / CASAS_DA_PROBABILIDADE;
}

function palavrasSignificativas(texto: string): Set<string> {
  const palavras = normalizar(texto).split(/[^a-z0-9]+/);
  return new Set(
    palavras.filter((p) => p.length >= TAMANHO_MINIMO_DE_PALAVRA && !PALAVRAS_COMUNS.has(p)),
  );
}

export function fracaoCoberta(referencia: string, avaliado: string): number {
  const alvo = palavrasSignificativas(referencia);
  if (alvo.size === 0) {
    return 0;
  }
  const presentes = palavrasSignificativas(avaliado);
  const encontradas = [...alvo].filter((palavra) => presentes.has(palavra)).length;
  return arredondar(Math.min(1, Math.max(0, encontradas / alvo.size)));
}
