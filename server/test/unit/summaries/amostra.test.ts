import { describe, expect, it } from 'vitest';

import type { CandidatoDoResumo } from '../../../src/modules/comments/comentarios.servico.js';
import {
  MAX_CARACTERES_DO_COMENTARIO,
  selecionarAmostra,
  TAMANHO_MAXIMO_DA_AMOSTRA,
} from '../../../src/modules/summaries/selecionar-amostra.js';

const UNIDADES = ['Centro', 'Sul', 'Norte', 'Leste'];

function candidatos(quantidade: number): CandidatoDoResumo[] {
  return Array.from({ length: quantidade }, (_v, i) => ({
    id: `id-${String(i).padStart(3, '0')}`,
    textoMascarado: `comentário número ${String(i)} sobre o tema`,
    comentadoEm: new Date(Date.UTC(2026, 0, 1 + i)),
    unidade: UNIDADES[i % UNIDADES.length] ?? null,
    gravidade: (i % 10) / 10,
    confiancaDoTema: i % 3 === 0 ? 0.5 : 0.9,
  }));
}

const PRINCIPAIS = [
  { unidade: 'Centro', total: 10, participacao: 25 },
  { unidade: 'Sul', total: 8, participacao: 20 },
  { unidade: 'Leste', total: 5, participacao: 12.5 },
];

describe('seleção da amostra', () => {
  it('respeita o limite de 20 comentários e numera de c1 em diante', () => {
    const amostra = selecionarAmostra(candidatos(100), PRINCIPAIS);

    expect(amostra).toHaveLength(TAMANHO_MAXIMO_DA_AMOSTRA);
    expect(amostra[0]?.id).toBe('c1');
    expect(amostra.at(-1)?.id).toBe('c20');
    expect(new Set(amostra.map((c) => c.comentarioId)).size).toBe(20);
  });

  it('é reproduzível: o mesmo conjunto escolhe sempre a mesma amostra', () => {
    const a = selecionarAmostra(candidatos(100), PRINCIPAIS);
    const b = selecionarAmostra(candidatos(100), PRINCIPAIS);

    expect(b).toEqual(a);
  });

  it('as mais graves vêm primeiro e só entram as de confiança do tema acima de 0,7', () => {
    const todos = candidatos(100);
    const amostra = selecionarAmostra(todos, PRINCIPAIS);
    const porId = new Map(todos.map((c) => [c.id, c]));
    const graves = amostra.slice(0, 8).map((c) => porId.get(c.comentarioId));

    expect(graves.every((c) => (c?.confiancaDoTema ?? 0) > 0.7)).toBe(true);
    const gravidades = graves.map((c) => c?.gravidade ?? 0);
    expect(gravidades).toEqual([...gravidades].sort((x, y) => y - x));
    expect(Math.min(...gravidades)).toBeGreaterThanOrEqual(0.8);
  });

  it('garante ao menos um comentário de cada unidade principal', () => {
    const todos = candidatos(100);
    const porId = new Map(todos.map((c) => [c.id, c]));

    const amostra = selecionarAmostra(todos, PRINCIPAIS);

    const unidades = new Set(amostra.map((c) => porId.get(c.comentarioId)?.unidade));
    for (const { unidade } of PRINCIPAIS) {
      expect(unidades.has(unidade)).toBe(true);
    }
  });

  it('remove quase duplicados e trunca o texto', () => {
    const repetidos = candidatos(5).map((c, i) => ({
      ...c,
      textoMascarado: i < 3 ? 'Mesmo texto, com Pontuação!' : 'x'.repeat(2000),
    }));

    const amostra = selecionarAmostra(repetidos, []);

    expect(amostra.filter((c) => c.texto.startsWith('Mesmo texto'))).toHaveLength(1);
    expect(Math.max(...amostra.map((c) => c.texto.length))).toBeLessThanOrEqual(
      MAX_CARACTERES_DO_COMENTARIO,
    );
  });
});
