import { describe, expect, it } from 'vitest';

import { gerarCsvDeExemplo, QUANTIDADE_NO_EXEMPLO } from '../../../scripts/gerar-fixtures.js';

describe('arquivo de exemplo', () => {
  it('gera o mesmo CSV a cada execução', () => {
    expect(gerarCsvDeExemplo()).toBe(gerarCsvDeExemplo());
  });

  it('traz 100 linhas com ponto e vírgula, acentos e UTF-8 com BOM', () => {
    const csv = gerarCsvDeExemplo();
    const linhas = csv.split('\r\n').filter((linha) => linha !== '');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(linhas[0]).toBe('﻿Data;Cliente;Comentário;Nota;Loja');
    expect(linhas).toHaveLength(QUANTIDADE_NO_EXEMPLO + 1);
    expect(linhas.slice(1).every((linha) => linha.split(';').length === 5)).toBe(true);
    expect(csv).toMatch(/atendimento|aplicativo|pedido/);
    expect(csv).toMatch(/[áàãâéêíóôõúç]/);
    expect(/^\d{2}\/\d{2}\/\d{4};/.test(linhas[1] ?? '')).toBe(true);
  });

  it('não traz dado pessoal nem fórmula', () => {
    const csv = gerarCsvDeExemplo();

    expect(csv).not.toMatch(/@|\(\d{2}\)|\d{3}\.\d{3}\.\d{3}/);
    expect(csv).not.toContain("'=");
  });
});
