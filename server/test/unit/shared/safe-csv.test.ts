import { describe, expect, it } from 'vitest';

import { iniciarCsv, montarLinhaDeCsv, neutralizarFormula } from '../../../src/shared/safe-csv.js';

describe('neutralizarFormula', () => {
  it.each([
    ['=SOMA(A1:A2)', "'=SOMA(A1:A2)"],
    ['+55 11 99999-0000', "'+55 11 99999-0000"],
    ['-1 estrela', "'-1 estrela"],
    ['@usuario', "'@usuario"],
    ['\tcom tabulação', "'\tcom tabulação"],
    ['\rcom retorno', "'\rcom retorno"],
    ['=HYPERLINK("http://x";"y")', '\'=HYPERLINK("http://x";"y")'],
  ])('prefixa aspa simples em %j', (entrada, esperado) => {
    expect(neutralizarFormula(entrada)).toBe(esperado);
  });

  it.each([
    'Atendimento ótimo',
    'Nota 10',
    'a=b',
    'e-mail',
    '',
    ' =depois do espaço',
    "'já com aspa",
  ])('mantém o texto comum %j', (entrada) => {
    expect(neutralizarFormula(entrada)).toBe(entrada);
  });
});

describe('montarLinhaDeCsv', () => {
  it('separa por ponto e vírgula, termina em CRLF e neutraliza só o texto', () => {
    const linha = montarLinhaDeCsv(['=cmd', 'normal', 5, -3, 0.85]);

    expect(linha).toBe("'=cmd;normal;5;-3;0,85\r\n");
  });

  it('não altera colunas numéricas, inclusive as negativas', () => {
    expect(montarLinhaDeCsv([-1, -0.5, 0])).toBe('-1;-0,5;0\r\n');
  });

  it('coloca entre aspas o que contém separador, aspas ou quebra de linha', () => {
    expect(montarLinhaDeCsv(['a;b', 'diz "oi"', 'duas\nlinhas'])).toBe(
      '"a;b";"diz ""oi""";"duas\nlinhas"\r\n',
    );
  });

  it('neutraliza antes de proteger com aspas', () => {
    expect(montarLinhaDeCsv(['=1;2'])).toBe('"\'=1;2"\r\n');
  });

  it('escreve vazio para nulo e Sim ou Não para booleano', () => {
    expect(montarLinhaDeCsv([null, undefined, true, false])).toBe(';;Sim;Não\r\n');
  });
});

describe('iniciarCsv', () => {
  it('começa com o BOM do UTF-8 e o cabeçalho acentuado', () => {
    const csv = iniciarCsv(['Comentário', 'Avaliação']);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(csv).toBe('﻿Comentário;Avaliação\r\n');
  });
});
