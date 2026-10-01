import { z } from 'zod';

import type { AvaliacaoDoGoogle } from './fonte-avaliacoes.js';

const NOTAS_POR_ESTRELA: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function converterEstrelas(estrelas: string | undefined): number | null {
  const nota = estrelas === undefined ? undefined : NOTAS_POR_ESTRELA[estrelas];
  return nota ?? null;
}

export const esquemaDeAvaliacaoBruta = z.object({
  reviewId: z.string().min(1),
  reviewer: z
    .object({ displayName: z.string().optional(), isAnonymous: z.boolean().optional() })
    .optional(),
  starRating: z.string().optional(),
  comment: z.string().optional(),
  createTime: z.string(),
  updateTime: z.string(),
});
export type AvaliacaoBruta = z.infer<typeof esquemaDeAvaliacaoBruta>;

export const esquemaDePaginaBruta = z.object({
  reviews: z.array(esquemaDeAvaliacaoBruta).optional(),
  nextPageToken: z.string().optional(),
});

export function paraAvaliacao(bruta: AvaliacaoBruta): AvaliacaoDoGoogle {
  const comentario = bruta.comment?.trim();
  const anonimo = bruta.reviewer?.isAnonymous === true;
  return {
    id: bruta.reviewId,
    nota: converterEstrelas(bruta.starRating),
    comentario: comentario === undefined || comentario === '' ? null : comentario,
    autor: anonimo ? null : (bruta.reviewer?.displayName ?? null),
    criadaEm: new Date(bruta.createTime),
    atualizadaEm: new Date(bruta.updateTime),
  };
}
