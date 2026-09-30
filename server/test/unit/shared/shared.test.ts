import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ErroDeConflito, ErroDeDominio, ErroNaoEncontrado } from '../../../src/shared/errors.js';
import {
  calcularDeslocamento,
  esquemaPaginacao,
  montarPagina,
} from '../../../src/shared/pagination.js';
import { dataNoFusoLocal, relogioDoSistema } from '../../../src/shared/clock.js';
import { criarRegistradorCapturado, criarRelogioFixo } from '../../helpers/factories.js';

const PASTA_SRC = join(import.meta.dirname, '../../../src');

function listarArquivosTs(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    return entrada.isDirectory() ? listarArquivosTs(caminho) : [caminho];
  });
}

describe('logs', () => {
  it('redige campos sensíveis na raiz, aninhados e em cabeçalhos', () => {
    const { registrador, texto } = criarRegistradorCapturado();

    registrador.info(
      {
        senha: 'senha-secreta',
        dados: { token: 'token-secreto', texto_mascarado: 'comentário do cliente' },
        texto_original: 'texto original do cliente',
        req: { headers: { authorization: 'Bearer abc', cookie: 'sessao=xyz' } },
        segredo: 'segredo-x',
      },
      'evento',
    );

    const saida = texto();
    for (const valor of [
      'senha-secreta',
      'token-secreto',
      'comentário do cliente',
      'texto original do cliente',
      'Bearer abc',
      'sessao=xyz',
      'segredo-x',
    ]) {
      expect(saida).not.toContain(valor);
    }
    expect(saida).toContain('[REDIGIDO]');
  });
});

describe('erros de domínio', () => {
  it('cada classe tem código estável e status HTTP', () => {
    expect(new ErroNaoEncontrado()).toMatchObject({ codigo: 'nao_encontrado', statusHttp: 404 });
    expect(new ErroDeConflito('duplicado')).toMatchObject({ codigo: 'conflito', statusHttp: 409 });
    expect(new ErroNaoEncontrado()).toBeInstanceOf(ErroDeDominio);
  });
});

describe('paginação', () => {
  it('aplica padrões e limita o tamanho da página a 100', () => {
    expect(esquemaPaginacao.parse({})).toEqual({ pagina: 1, tamanhoPagina: 20 });
    expect(esquemaPaginacao.safeParse({ tamanhoPagina: '101' }).success).toBe(false);
    expect(esquemaPaginacao.safeParse({ pagina: '0' }).success).toBe(false);
  });

  it('recusa chave desconhecida', () => {
    expect(esquemaPaginacao.safeParse({ contaId: 'x' }).success).toBe(false);
  });

  it('calcula deslocamento e monta a saída padrão', () => {
    const entrada = esquemaPaginacao.parse({ pagina: '3', tamanhoPagina: '10' });

    expect(calcularDeslocamento(entrada)).toBe(20);
    expect(montarPagina(['a'], 21, entrada)).toEqual({
      itens: ['a'],
      total: 21,
      pagina: 3,
      tamanhoPagina: 10,
    });
  });
});

describe('tempo', () => {
  it('o relógio do sistema devolve a hora atual e o fixo devolve sempre a mesma', () => {
    const fixo = criarRelogioFixo(new Date('2026-01-01T12:00:00Z'));

    expect(fixo.agora().toISOString()).toBe('2026-01-01T12:00:00.000Z');
    expect(Math.abs(relogioDoSistema.agora().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('a data civil usa o fuso de São Paulo', () => {
    // 02:30 UTC ainda é o dia anterior em São Paulo (UTC-3).
    expect(dataNoFusoLocal(new Date('2026-03-10T02:30:00Z'))).toBe('2026-03-09');
    expect(dataNoFusoLocal(new Date('2026-03-10T15:00:00Z'))).toBe('2026-03-10');
  });
});

describe('estrutura', () => {
  it('nenhum process.env fora de config.ts', () => {
    const infratores = listarArquivosTs(PASTA_SRC)
      .filter((arquivo) => !arquivo.endsWith('config.ts'))
      .filter((arquivo) => readFileSync(arquivo, 'utf8').includes('process.env'))
      .map((arquivo) => relative(PASTA_SRC, arquivo));

    expect(infratores).toEqual([]);
  });
});
