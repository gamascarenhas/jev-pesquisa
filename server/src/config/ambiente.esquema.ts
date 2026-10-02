import { z } from 'zod';

export type VariaveisBrutas = Record<string, string | undefined>;

export const TAMANHO_MINIMO_SEGREDO_SESSAO = 32;
export const TAMANHO_CHAVE_CRIPTOGRAFIA_BYTES = 32;

const ORIGEM_ESTILO_PADRAO = 'https://fonts.googleapis.com';
const ORIGEM_FONTE_PADRAO = 'https://fonts.gstatic.com';

const obrigatoria = () =>
  z.string({
    error: (problema) =>
      problema.input === undefined ? 'variável obrigatória ausente' : 'valor inválido',
  });

const booleano = (padrao: boolean) =>
  z
    .enum(['true', 'false'], { error: 'use true ou false' })
    .default(padrao ? 'true' : 'false')
    .transform((valor) => valor === 'true');

const inteiroPositivo = (padrao: number) => z.coerce.number().int().min(1).default(padrao);

const listaDeOrigens = (padrao: string) =>
  z
    .string()
    .default(padrao)
    .transform((valor) =>
      valor
        .split(',')
        .map((origem) => origem.trim())
        .filter((origem) => origem !== ''),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ }), { error: 'use URLs separadas por vírgula' }));

const chaveEmBase64 = obrigatoria().refine(
  (valor) => Buffer.from(valor, 'base64').length === TAMANHO_CHAVE_CRIPTOGRAFIA_BYTES,
  "precisa ser base64 de exatamente 32 bytes; gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
);

const urlDeBanco = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'precisa começar com postgres:// ou postgresql://');

export const esquemaAmbiente = z.object({
  URL_APP: obrigatoria().pipe(
    z.url({ protocol: /^https?$/, error: 'precisa ser uma URL http(s)' }),
  ),
  URL_SITE: obrigatoria()
    .pipe(z.url({ protocol: /^https?$/, error: 'precisa ser uma URL http(s)' }))
    .refine(
      (valor) => new URL(valor).origin === valor,
      'use só a origem, sem barra final nem caminho',
    ),
  NOME_NEGOCIO: obrigatoria(),
  VERSAO_TERMOS: obrigatoria(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CONFIAR_PROXY: booleano(false),
  SEGREDO_SESSAO: obrigatoria().min(
    TAMANHO_MINIMO_SEGREDO_SESSAO,
    `precisa ter ao menos ${String(TAMANHO_MINIMO_SEGREDO_SESSAO)} caracteres; use uma string aleatória longa`,
  ),
  CHAVE_CRIPTOGRAFIA: chaveEmBase64,

  URL_BANCO: obrigatoria().pipe(urlDeBanco),
  URL_BANCO_TESTES: urlDeBanco.optional(),

  PROVEDOR_EMAIL: z.enum(['log', 'smtp'], { error: 'use log ou smtp' }),
  SMTP_SERVIDOR: z.string().optional(),
  SMTP_PORTA: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USUARIO: z.string().optional(),
  SMTP_SENHA: z.string().optional(),
  EMAIL_REMETENTE: z.string().optional(),

  JEV_SIMULADO: booleano(false),
  CHAVE_API_TYPESAFE: z.string().optional(),
  JEV_MODELO: z.string().default('jev-1.13.0'),
  JEV_CONCORRENCIA: inteiroPositivo(10),
  JEV_PRECO_POR_MTOK: z.coerce.number().positive().default(0.042),

  LLM_PROVEDOR: z
    .enum(['anthropic', 'mock'], { error: 'use anthropic ou mock' })
    .default('anthropic'),
  LLM_CHAVE_API: z.string().optional(),
  LLM_MODELO: z.string().optional(),
  LLM_PRECO_ENTRADA_POR_MTOK: z.coerce.number().positive().optional(),
  LLM_PRECO_SAIDA_POR_MTOK: z.coerce.number().positive().optional(),
  LLM_RESUMO_MAX_TOKENS: inteiroPositivo(1200),
  RESUMO_LIMIAR_SUSTENTACAO: z.coerce.number().min(0).max(1).default(0.7),

  PERGUNTAR_MAX_COMENTARIOS: inteiroPositivo(5000),

  GOOGLE_EMPRESA_SIMULADO: booleano(false),
  GOOGLE_ID_CLIENTE: z.string().optional(),
  GOOGLE_SEGREDO_CLIENTE: z.string().optional(),
  GOOGLE_URI_REDIRECIONAMENTO: z.url({ protocol: /^https?$/ }).optional(),
  GOOGLE_INTERVALO_SINCRONIZACAO_HORAS: inteiroPositivo(24),

  PLANO_PADRAO_ID: z.string().default('trial'),
  COBRANCA_ATIVADA: booleano(false),

  ORIGENS_ESTILO_EXTERNO: listaDeOrigens(ORIGEM_ESTILO_PADRAO),
  ORIGENS_FONTE_EXTERNA: listaDeOrigens(ORIGEM_FONTE_PADRAO),
});

export type VariaveisAmbiente = z.infer<typeof esquemaAmbiente>;

interface GrupoCondicional {
  aplica: (variaveis: VariaveisBrutas) => boolean;
  variaveis: string[];
  motivo: string;
}

// Obrigatórias só para o modo configurado.
const GRUPOS_CONDICIONAIS: GrupoCondicional[] = [
  {
    aplica: (v) => v.PROVEDOR_EMAIL === 'smtp',
    variaveis: ['SMTP_SERVIDOR', 'SMTP_PORTA', 'SMTP_USUARIO', 'SMTP_SENHA', 'EMAIL_REMETENTE'],
    motivo: 'obrigatória com PROVEDOR_EMAIL=smtp',
  },
  {
    aplica: (v) => v.JEV_SIMULADO !== 'true',
    variaveis: ['CHAVE_API_TYPESAFE'],
    motivo: 'obrigatória com JEV_SIMULADO=false',
  },
  {
    aplica: (v) => (v.LLM_PROVEDOR ?? 'anthropic') === 'anthropic',
    variaveis: [
      'LLM_CHAVE_API',
      'LLM_MODELO',
      'LLM_PRECO_ENTRADA_POR_MTOK',
      'LLM_PRECO_SAIDA_POR_MTOK',
    ],
    motivo: 'obrigatória com LLM_PROVEDOR=anthropic',
  },
  {
    aplica: (v) => v.GOOGLE_EMPRESA_SIMULADO !== 'true',
    variaveis: ['GOOGLE_ID_CLIENTE', 'GOOGLE_SEGREDO_CLIENTE', 'GOOGLE_URI_REDIRECIONAMENTO'],
    motivo: 'obrigatória com GOOGLE_EMPRESA_SIMULADO=false',
  },
];

/** `CHAVE=` vazia vale o mesmo que ausente. */
export function normalizarVariaveis(variaveis: VariaveisBrutas): Record<string, string> {
  const normalizadas: Record<string, string> = {};
  for (const [nome, valor] of Object.entries(variaveis)) {
    const limpo = valor?.trim();
    if (limpo !== undefined && limpo !== '') {
      normalizadas[nome] = limpo;
    }
  }
  return normalizadas;
}

export function verificarObrigatoriedadesCondicionais(variaveis: VariaveisBrutas): string[] {
  const problemas: string[] = [];
  for (const grupo of GRUPOS_CONDICIONAIS.filter((g) => g.aplica(variaveis))) {
    for (const nome of grupo.variaveis.filter((n) => variaveis[n] === undefined)) {
      problemas.push(`${nome}: ${grupo.motivo}`);
    }
  }
  if (variaveis.COBRANCA_ATIVADA === 'true') {
    problemas.push('COBRANCA_ATIVADA: o provedor de cobrança real não existe no MVP; use false');
  }
  return problemas;
}
