import { describe, expect, it } from 'vitest';

import { mascararTexto } from '../../../src/modules/comments/anonimizador.js';

describe('mascararTexto', () => {
  describe('mascara dados pessoais', () => {
    it.each([
      ['CPF com pontuação', 'Meu CPF é 123.456.789-09, ok?', 'Meu CPF é [CPF], ok?'],
      ['CPF sem pontuação e válido', 'cpf 52998224725 aqui', 'cpf [CPF] aqui'],
      ['CPF com pontuação e dígito inválido', 'cpf 111.222.333-44', 'cpf [CPF]'],
      ['CNPJ com pontuação', 'empresa 11.222.333/0001-81 ltda', 'empresa [CNPJ] ltda'],
      ['CNPJ sem pontuação e válido', 'cnpj 11222333000181.', 'cnpj [CNPJ].'],
      ['e-mail', 'escrevam para joao.silva+loja@empresa.com.br hoje', 'escrevam para [EMAIL] hoje'],
      ['e-mail com acento no domínio', 'ana@correção.com.br', '[EMAIL]'],
      ['celular com DDD entre parênteses', 'liguem (11) 98765-4321 já', 'liguem [TELEFONE] já'],
      ['celular com +55', 'whats +55 11 98765-4321', 'whats [TELEFONE]'],
      ['fixo com DDD', 'telefone 11 3333-4444', 'telefone [TELEFONE]'],
      ['fixo com DDD entre parênteses sem espaço', 'tel (21)3333-4444', 'tel [TELEFONE]'],
      ['celular sem DDD', 'me chama no 98765-4321', 'me chama no [TELEFONE]'],
      ['celular contíguo com DDD', 'numero 11987654320 ok', 'numero [TELEFONE] ok'],
      ['CEP com hífen', 'moro no 01310-100 em SP', 'moro no [CEP] em SP'],
      ['CEP precedido da palavra CEP', 'CEP: 01310100', '[CEP]'],
      ['CEP em minúsculas', 'cep 01310-100', '[CEP]'],
      [
        'vários dados na mesma frase',
        'Sou o Ana, a@b.com, (11) 91234-5678, CEP 01310-100',
        'Sou o Ana, [EMAIL], [TELEFONE], [CEP]',
      ],
    ])('%s', (_nome, entrada, esperado) => {
      expect(mascararTexto(entrada)).toBe(esperado);
    });
  });

  describe('não mascara falsos positivos', () => {
    it.each([
      ['valor em reais', 'paguei R$ 1.234,56 no total'],
      ['valor em reais sem centavos', 'custou R$ 12.345'],
      ['data com barras', 'visitei em 12/03/2024 às 14h'],
      ['data ISO', 'em 2024-12-31 recebi'],
      ['número de pedido de nove dígitos', 'pedido 123456789 atrasou'],
      ['número de pedido de onze dígitos com dígito inválido', 'protocolo 12345678901'],
      ['número de pedido de catorze dígitos com dígito inválido', 'rastreio 12345678901234'],
      ['nota e tempo', 'dou nota 10, esperei 15 minutos'],
      ['porcentagem e decimal', 'desconto de 12,5% e 1.500,00 reais'],
      ['ano isolado', 'desde 2019 sou cliente'],
    ])('%s', (_nome, entrada) => {
      expect(mascararTexto(entrada)).toBe(entrada);
    });
  });

  it('não altera texto sem dados pessoais', () => {
    expect(mascararTexto('Atendimento excelente, voltarei!')).toBe(
      'Atendimento excelente, voltarei!',
    );
  });
});
