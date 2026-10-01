import { noul } from '@typesafe-ai/sdk';
import { describe, expect, it } from 'vitest';

import { criarClassificadorSimulado } from '../../../src/integrations/jev/classificador-simulado.js';

const jev = criarClassificadorSimulado();

async function classificar(texto: string, nota: number | null = null) {
  const { respostas } = await jev.classificarComentario({
    comment: texto,
    rating: nota,
    location: null,
  });
  return respostas;
}

describe('Jev simulado: perguntas padrão', () => {
  it('classifica por palavras-chave com probabilidades e confiança fixas', async () => {
    const respostas = await classificar(
      'A fila estava enorme e a espera passou de quarenta minutos',
    );

    expect(respostas.topic).toMatchObject({ choice: 'wait_time', confidence: 0.8 });
    expect(respostas.sentiment).toMatchObject({ choice: 'negative', confidence: 0.85 });
    expect(respostas.severity.score).toBe(1);
    expect(respostas.needs_action.noul).toBe(0.85);
    const soma = Object.values(respostas.topic.probabilities).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 3);
  });

  it('reconhece elogio, comentário misto e texto sem assunto', async () => {
    const elogio = await classificar('Atendimento excelente, recomendo');
    const misto = await classificar('O atendimento foi ótimo mas a fila estava enorme');
    const vazio = await classificar('Passei por aí');

    expect(elogio.sentiment.choice).toBe('positive');
    expect(elogio.severity.score).toBe(0);
    expect(elogio.needs_action.noul).toBe(0.1);
    expect(misto.sentiment.choice).toBe('mixed');
    expect(vazio.topic).toMatchObject({ choice: 'other', confidence: 0.4 });
    expect(vazio.sentiment.choice).toBe('neutral');
  });

  it('sobe a gravidade quando há ameaça, prejuízo ou intenção de sair', async () => {
    const grave = await classificar('Vou ao Procon, fui enganado e não volto mais');
    const falha = await classificar('O aplicativo travou e perdi tempo, uma ruim experiência');

    expect(grave.severity.score).toBe(3);
    expect(falha.severity.score).toBeGreaterThanOrEqual(2);
  });

  it('devolve a legenda da gravidade e é determinístico', async () => {
    const primeira = await classificar('Produto veio com defeito', 1);
    const segunda = await classificar('Produto veio com defeito', 1);

    expect(primeira).toEqual(segunda);
    expect(Object.keys(primeira.severity.legend)).toEqual(['0', '1', '2', '3']);
  });
});

describe('Jev simulado: método genérico avaliar', () => {
  it('responde de forma determinística a uma pergunta noul desconhecida', async () => {
    const pergunta = { fria: noul('A pessoa reclamou de comida fria e demora?') };
    const estado = { comment: 'A comida chegou fria e atrasou muito' };

    const a = await jev.avaliar(estado, pergunta);
    const b = await jev.avaliar(estado, pergunta);

    expect(a.respostas.fria.noul).toBe(b.respostas.fria.noul);
    expect(a.respostas.fria.noul).toBeGreaterThan(0);
    expect(a.respostas.fria.noul).toBeLessThanOrEqual(1);
    expect(a.modelo).toBe('jev-simulado');
    expect(a.tentativasAmbiguas).toBe(0);
  });

  it('para perguntas livres, mede as palavras significativas das instruções presentes no comentário', async () => {
    const instrucoes = 'Reclamou do estacionamento lotado "estacionamento" "lotado"';
    const todas = await jev.avaliar(
      { comment: 'O estacionamento estava lotado' },
      { p: noul(instrucoes) },
    );
    const nenhuma = await jev.avaliar({ comment: 'Gostei muito do bolo' }, { p: noul(instrucoes) });

    expect(todas.respostas.p.noul).toBeGreaterThan(nenhuma.respostas.p.noul);
    expect(nenhuma.respostas.p.noul).toBe(0);
  });

  it('para verificação de achados, compara state.claim com os trechos de state.evidence', async () => {
    const pergunta = { supported: noul('Is the claim supported by the evidence?') };
    const apoiado = await jev.avaliar(
      {
        claim: 'Clientes reclamam da demora no atendimento',
        evidence: [
          { text: 'A demora no atendimento foi enorme' },
          { text: 'Clientes reclamam muito' },
        ],
      },
      pergunta,
    );
    const sem = await jev.avaliar(
      {
        claim: 'Clientes reclamam da demora no atendimento',
        evidence: [{ text: 'Adorei o bolo' }],
      },
      pergunta,
    );

    expect(apoiado.respostas.supported.noul).toBe(1);
    expect(sem.respostas.supported.noul).toBe(0);
  });

  it('informa o uso em tokens', async () => {
    const { uso } = await jev.classificarComentario({
      comment: 'ok',
      rating: null,
      location: null,
    });

    expect(uso.tokensEntrada).toBeGreaterThan(0);
    expect(uso.tokensSaida).toBe(40);
  });
});
