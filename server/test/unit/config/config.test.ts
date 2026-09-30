import { describe, expect, it } from 'vitest';

import { esquemaAmbiente } from '../../../src/config/ambiente.esquema.js';
import { ErroDeConfiguracao, validarConfiguracao } from '../../../src/config/config.js';
import {
  CHAVE_CRIPTOGRAFIA_INSEGURA,
  SEGREDO_SESSAO_INSEGURO,
} from '../../../src/config/padroes-inseguros.js';
import { criarVariaveisDeProducaoValidas, lerExemploDeAmbiente } from '../../helpers/factories.js';

function problemasDe(acao: () => unknown): string[] {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof ErroDeConfiguracao) {
      return erro.problemas;
    }
    throw erro;
  }
  throw new Error('a configuração deveria ter sido recusada');
}

function semVariavel(variaveis: Record<string, string>, nome: string): Record<string, string> {
  return Object.fromEntries(Object.entries(variaveis).filter(([chave]) => chave !== nome));
}

describe('configuração em desenvolvimento', () => {
  it('aceita o .env.development.example sem nenhuma alteração', () => {
    const config = validarConfiguracao('development', lerExemploDeAmbiente('development'));

    expect(config.nomeNegocio).toBe('Escuta');
    expect(config.estaEmProducao).toBe(false);
    expect(config.origemApp).toBe('http://localhost:5173');
    expect(config.jev.simulado).toBe(true);
    expect(config.chaveCriptografia).toHaveLength(32);
  });

  it.each(['NOME_NEGOCIO', 'VERSAO_TERMOS', 'URL_APP', 'SEGREDO_SESSAO', 'URL_BANCO'])(
    'recusa iniciar sem %s, apontando a variável',
    (nome) => {
      const variaveis = semVariavel(lerExemploDeAmbiente('development'), nome);

      const problemas = problemasDe(() => validarConfiguracao('development', variaveis));

      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain(nome);
    },
  );

  it('trata variável vazia como ausente', () => {
    const variaveis = { ...lerExemploDeAmbiente('development'), NOME_NEGOCIO: '   ' };

    const problemas = problemasDe(() => validarConfiguracao('development', variaveis));

    expect(problemas[0]).toContain('NOME_NEGOCIO');
  });

  it('lista todos os problemas de uma vez, e a mensagem do erro também', () => {
    const variaveis = semVariavel(
      semVariavel(lerExemploDeAmbiente('development'), 'NOME_NEGOCIO'),
      'VERSAO_TERMOS',
    );

    let erro: unknown;
    try {
      validarConfiguracao('development', variaveis);
    } catch (falha) {
      erro = falha;
    }

    expect(erro).toBeInstanceOf(ErroDeConfiguracao);
    const mensagem = (erro as ErroDeConfiguracao).message;
    expect(mensagem).toContain('NOME_NEGOCIO');
    expect(mensagem).toContain('VERSAO_TERMOS');
  });

  it('exige as chaves reais quando o modo simulado está desligado', () => {
    const variaveis = {
      ...lerExemploDeAmbiente('development'),
      JEV_SIMULADO: 'false',
      LLM_PROVEDOR: 'anthropic',
      GOOGLE_EMPRESA_SIMULADO: 'false',
      GOOGLE_URI_REDIRECIONAMENTO: '',
      PROVEDOR_EMAIL: 'smtp',
    };

    const texto = problemasDe(() => validarConfiguracao('development', variaveis)).join('\n');

    for (const nome of [
      'CHAVE_API_TYPESAFE',
      'LLM_CHAVE_API',
      'LLM_MODELO',
      'GOOGLE_ID_CLIENTE',
      'GOOGLE_URI_REDIRECIONAMENTO',
      'SMTP_SERVIDOR',
      'EMAIL_REMETENTE',
    ]) {
      expect(texto).toContain(nome);
    }
  });

  it('recusa chave de criptografia que não tem 32 bytes', () => {
    const variaveis = {
      ...lerExemploDeAmbiente('development'),
      CHAVE_CRIPTOGRAFIA: Buffer.alloc(16).toString('base64'),
    };

    const problemas = problemasDe(() => validarConfiguracao('development', variaveis));

    expect(problemas[0]).toContain('CHAVE_CRIPTOGRAFIA');
  });

  it('recusa cobrança ativada, porque o provedor real não existe no MVP', () => {
    const variaveis = { ...lerExemploDeAmbiente('development'), COBRANCA_ATIVADA: 'true' };

    const problemas = problemasDe(() => validarConfiguracao('development', variaveis));

    expect(problemas[0]).toContain('COBRANCA_ATIVADA');
  });

  it('devolve uma configuração imutável', () => {
    const config = validarConfiguracao('development', lerExemploDeAmbiente('development'));

    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe('travas de produção', () => {
  it('aceita uma configuração de produção completa e segura', () => {
    const config = validarConfiguracao('production', criarVariaveisDeProducaoValidas());

    expect(config.estaEmProducao).toBe(true);
    expect(config.confiarProxy).toBe(true);
    expect(config.urlBancoTestes).toBeUndefined();
  });

  it.each([
    ['JEV_SIMULADO', { JEV_SIMULADO: 'true' }],
    ['GOOGLE_EMPRESA_SIMULADO', { GOOGLE_EMPRESA_SIMULADO: 'true' }],
    ['LLM_PROVEDOR', { LLM_PROVEDOR: 'mock' }],
    ['PROVEDOR_EMAIL', { PROVEDOR_EMAIL: 'log' }],
    ['URL_APP', { URL_APP: 'http://app.exemplo.com.br' }],
    [
      'GOOGLE_URI_REDIRECIONAMENTO',
      { GOOGLE_URI_REDIRECIONAMENTO: 'http://app.exemplo.com.br/cb' },
    ],
    ['SEGREDO_SESSAO', { SEGREDO_SESSAO: SEGREDO_SESSAO_INSEGURO }],
    ['CHAVE_CRIPTOGRAFIA', { CHAVE_CRIPTOGRAFIA: CHAVE_CRIPTOGRAFIA_INSEGURA }],
    ['URL_BANCO_TESTES', { URL_BANCO_TESTES: 'postgres://u:s@localhost:5432/teste' }],
  ])('recusa iniciar em produção por causa de %s', (nome, alteracao) => {
    const variaveis = { ...criarVariaveisDeProducaoValidas(), ...alteracao };

    const problemas = problemasDe(() => validarConfiguracao('production', variaveis));

    expect(problemas.some((problema) => problema.startsWith(nome))).toBe(true);
  });

  it('recusa segredo de sessão curto', () => {
    const variaveis = { ...criarVariaveisDeProducaoValidas(), SEGREDO_SESSAO: 'curto' };

    const problemas = problemasDe(() => validarConfiguracao('production', variaveis));

    expect(problemas[0]).toContain('SEGREDO_SESSAO');
  });

  it('o exemplo de produção, sem preencher, não sobe', () => {
    const problemas = problemasDe(() =>
      validarConfiguracao('production', lerExemploDeAmbiente('production')),
    );
    const texto = problemas.join('\n');

    expect(texto).toContain('NOME_NEGOCIO');
    expect(texto).toContain('SEGREDO_SESSAO');
    expect(texto).toContain('CHAVE_CRIPTOGRAFIA');
  });
});

describe('arquivos de exemplo', () => {
  it('os valores inseguros registrados são exatamente os do exemplo de desenvolvimento', () => {
    const exemplo = lerExemploDeAmbiente('development');

    expect(exemplo.SEGREDO_SESSAO).toBe(SEGREDO_SESSAO_INSEGURO);
    expect(exemplo.CHAVE_CRIPTOGRAFIA).toBe(CHAVE_CRIPTOGRAFIA_INSEGURA);
  });

  it('os dois exemplos trazem toda variável do esquema, e só o de desenvolvimento tem URL_BANCO_TESTES', () => {
    const chavesDoEsquema = Object.keys(esquemaAmbiente.shape);
    const desenvolvimento = Object.keys(lerExemploDeAmbiente('development'));
    const producao = Object.keys(lerExemploDeAmbiente('production'));

    expect(desenvolvimento).toEqual(expect.arrayContaining(chavesDoEsquema));
    expect(producao).toEqual(
      expect.arrayContaining(chavesDoEsquema.filter((chave) => chave !== 'URL_BANCO_TESTES')),
    );
    expect(producao).not.toContain('URL_BANCO_TESTES');
  });
});
