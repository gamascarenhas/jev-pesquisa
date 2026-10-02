import type { VariaveisBrutas } from './ambiente.esquema.js';
import { PADROES_INSEGUROS } from './padroes-inseguros.js';

interface Trava {
  violada: (variaveis: VariaveisBrutas) => boolean;
  problema: string;
}

const naoUsaHttps = (valor: string | undefined): boolean =>
  valor !== undefined && !valor.toLowerCase().startsWith('https://');

const ehPadraoInseguro = (valor: string | undefined): boolean =>
  valor !== undefined && PADROES_INSEGUROS.includes(valor);

const TRAVAS: Trava[] = [
  {
    violada: (v) => v.JEV_SIMULADO === 'true',
    problema: 'JEV_SIMULADO: modo simulado é proibido em produção; use false',
  },
  {
    violada: (v) => v.GOOGLE_EMPRESA_SIMULADO === 'true',
    problema: 'GOOGLE_EMPRESA_SIMULADO: modo simulado é proibido em produção; use false',
  },
  {
    violada: (v) => v.LLM_PROVEDOR === 'mock',
    problema: 'LLM_PROVEDOR: mock é proibido em produção; use anthropic',
  },
  {
    violada: (v) => v.PROVEDOR_EMAIL === 'log',
    problema: 'PROVEDOR_EMAIL: log é proibido em produção; use smtp',
  },
  {
    violada: (v) => naoUsaHttps(v.URL_APP),
    problema: 'URL_APP: em produção precisa usar https',
  },
  {
    violada: (v) => naoUsaHttps(v.URL_SITE),
    problema: 'URL_SITE: em produção precisa usar https',
  },
  {
    violada: (v) => naoUsaHttps(v.GOOGLE_URI_REDIRECIONAMENTO),
    problema: 'GOOGLE_URI_REDIRECIONAMENTO: em produção precisa usar https',
  },
  {
    violada: (v) => ehPadraoInseguro(v.SEGREDO_SESSAO),
    problema: 'SEGREDO_SESSAO: igual ao valor inseguro do exemplo de desenvolvimento; gere outro',
  },
  {
    violada: (v) => ehPadraoInseguro(v.CHAVE_CRIPTOGRAFIA),
    problema:
      'CHAVE_CRIPTOGRAFIA: igual ao valor inseguro do exemplo de desenvolvimento; gere outra',
  },
  {
    violada: (v) => v.URL_BANCO_TESTES !== undefined,
    problema: 'URL_BANCO_TESTES: não pode existir em produção; remova a variável',
  },
];

export function verificarTravasDeProducao(variaveis: VariaveisBrutas): string[] {
  return TRAVAS.filter((trava) => trava.violada(variaveis)).map((trava) => trava.problema);
}
